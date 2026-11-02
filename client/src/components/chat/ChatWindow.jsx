import { useEffect, useState, useRef } from "react";
import {
  Send,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Download,
  Trash2,
  FileText,
  X,
  Lock,
  Search,
  MoreVertical,
  Mic,
  ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_AVATAR = "/default-avatar.jpeg";

const getAvatar = (avatar) => {
  if (!avatar || typeof avatar !== "string" || avatar.trim() === "")
    return DEFAULT_AVATAR;
  return avatar;
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return "offline";
  const now = new Date();
  const last = new Date(lastSeen);
  const diffMs = now - last;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "offline";
  if (diffMins < 60) return `last seen ${Math.max(1, diffMins)}m ago`;
  if (diffHours < 24) return `last seen ${diffHours}h ago`;
  if (diffDays < 7) return `last seen ${diffDays}d ago`;

  return `last seen ${last.toLocaleDateString()}`;
};

export default function ChatWindow({ chat, user, users = [], onRequireAuth }) {
  const { token } = useAuth();
  const { socket } = useSocket();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState(null);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const API = import.meta.env.VITE_API_URL || "";

  /* ================= FETCH MESSAGES ================= */
  useEffect(() => {
    if (!chat?._id || !token) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API}/api/message/${chat._id}?limit=60`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load messages");

        const data = await res.json();
        if (cancelled) return;

        const rawList = Array.isArray(data) ? data : data.messages || [];

        setMessages(
          rawList.map((m) => ({
            id: m._id,
            clientId: m.clientId || null,
            senderId: m.sender?._id || m.sender,
            senderName: m.sender?.displayName || "User",
            senderAvatar: m.sender?.avatar || "",
            type: m.type || "text",
            text: m.content,
            file: m.file,
            status: m.status || (m.readBy?.length > 1 ? "read" : "sent"),
            deleted: Boolean(m.deleted),
            timestamp: new Date(m.createdAt).getTime(),
          }))
        );

        if (socket) {
          socket.emit("mark_read", { chatId: chat._id });
        }
      } catch (err) {
        console.error("Fetch messages error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chat?._id, token, socket]);

  /* ================= REAL-TIME SOCKET SUBSCRIPTION ================= */
  useEffect(() => {
    if (!chat?._id || !socket) return;

    socket.emit("join_chat", chat._id);

    const handleNewMessage = (m) => {
      if (m.chatId !== chat._id) return;

      const serverMsg = {
        id: m._id,
        clientId: m.clientId || null,
        senderId: m.sender?._id || m.sender,
        senderName: m.sender?.displayName || "User",
        senderAvatar: m.sender?.avatar || "",
        type: m.type,
        text: m.content,
        file: m.file,
        status: m.status || "sent",
        deleted: Boolean(m.deleted),
        timestamp: new Date(m.createdAt).getTime(),
      };

      setMessages((prev) => {
        // If message with same server id already exists, update it in place
        if (prev.some((x) => x.id === serverMsg.id)) {
          return prev.map((x) => (x.id === serverMsg.id ? serverMsg : x));
        }

        // If an optimistic message was created with the same clientId, replace it in place
        if (
          serverMsg.clientId &&
          prev.some((x) => x.clientId === serverMsg.clientId)
        ) {
          return prev.map((x) =>
            x.clientId === serverMsg.clientId ? serverMsg : x
          );
        }

        // Prevent duplicate self-messages or recent identical messages
        if (user && (serverMsg.senderId === user._id || serverMsg.senderId === user.id)) {
          const matchIdx = prev.findIndex(
            (x) =>
              (x.clientId && x.clientId === serverMsg.clientId) ||
              (!x.id?.toString().startsWith("6") &&
                x.text === serverMsg.text &&
                Math.abs(x.timestamp - serverMsg.timestamp) < 10000)
          );
          if (matchIdx !== -1) {
            return prev.map((x, idx) => (idx === matchIdx ? serverMsg : x));
          }
        }

        return [...prev, serverMsg];
      });
    };

    const handleMessageDeleted = ({ chatId, messageId }) => {
      if (chatId !== chat._id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deleted: true, text: "This message was deleted", file: null }
            : m
        )
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);

    return () => {
      socket.emit("leave_chat", chat._id);
      socket.off("new_message", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
    };
  }, [chat?._id, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= SEND MESSAGE (LOW LATENCY) ================= */
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!user) {
      onRequireAuth?.();
      return;
    }

    const trimmed = input.trim();
    if (!trimmed && !pendingFile) return;

    const clientId = crypto.randomUUID();
    const currentFile = pendingFile;

    // Instant optimistic update (0ms UI latency)
    const optimisticMsg = {
      id: clientId,
      clientId,
      senderId: user._id,
      senderName: user.displayName,
      senderAvatar: user.avatar,
      type: currentFile ? currentFile.type : "text",
      text: trimmed,
      file: currentFile
        ? {
            name: currentFile.file.name,
            mime: currentFile.file.type,
            data: currentFile.base64,
            size: currentFile.file.size,
          }
        : null,
      status: "sent",
      deleted: false,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    setPendingFile(null);

    try {
      if (currentFile) {
        // Upload media file (photo/audio/video/document)
        const form = new FormData();
        form.append("file", currentFile.file);
        form.append("type", currentFile.type);
        form.append("clientId", clientId);

        const res = await fetch(`${API}/api/message/${chat._id}/file`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        });

        if (res.ok) {
          const saved = await res.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.clientId === clientId
                ? {
                    id: saved._id,
                    clientId: saved.clientId || clientId,
                    senderId: saved.sender?._id || user._id,
                    senderName: saved.sender?.displayName || user.displayName,
                    senderAvatar: saved.sender?.avatar || user.avatar,
                    type: saved.type,
                    text: saved.content,
                    file: saved.file,
                    status: saved.status || "sent",
                    deleted: saved.deleted,
                    timestamp: new Date(saved.createdAt).getTime(),
                  }
                : m
            )
          );
        }
      } else {
        const res = await fetch(`${API}/api/message/${chat._id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: trimmed,
            clientId,
          }),
        });

        if (res.ok) {
          const saved = await res.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.clientId === clientId
                ? {
                    id: saved._id,
                    clientId: saved.clientId || clientId,
                    senderId: saved.sender?._id || user._id,
                    senderName: saved.sender?.displayName || user.displayName,
                    senderAvatar: saved.sender?.avatar || user.avatar,
                    type: saved.type,
                    text: saved.content,
                    file: saved.file,
                    status: saved.status || "sent",
                    deleted: saved.deleted,
                    timestamp: new Date(saved.createdAt).getTime(),
                  }
                : m
            )
          );
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  /* ================= FILE SELECT (PHOTOS / AUDIO / VIDEO) ================= */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File size exceeds 50MB limit");
      return;
    }

    let type = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("audio/")) type = "audio";

    const base64 = await fileToBase64(file);
    setPendingFile({
      file,
      type,
      base64,
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2),
    });

    e.target.value = "";
    inputRef.current?.focus();
  };

  /* ================= DELETE MESSAGE ================= */
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      const res = await fetch(`${API}/api/message/${chat._id}/${messageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, deleted: true, text: "This message was deleted", file: null }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Delete message error:", err);
    }
  };

  const getHeaderUser = () => {
    if (!chat || !chat.participants || !user) return null;
    const myId = String(user._id);
    const isSelf = chat.participants.every((p) => String(p?._id || p) === myId);

    if (isSelf) {
      const liveSelf = users?.find((u) => String(u._id) === myId);
      return liveSelf || user;
    }

    const other = chat.participants.find((p) => String(p?._id || p) !== myId);
    const otherId = String(other?._id || other);
    const liveOther = users?.find((u) => String(u._id) === otherId);
    if (liveOther) return liveOther;

    return typeof other === "object" ? other : { _id: otherId, displayName: "User" };
  };

  const headerUser = getHeaderUser();
  const isMe = (msg) => !!user && msg.senderId === user._id;

  const formatMsgTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  /* ================= MESSAGE BODY ================= */
  const renderMessageBody = (msg) => {
    if (msg.deleted) {
      return (
        <span className="italic text-[#8696A0] text-xs">
          🚫 This message was deleted
        </span>
      );
    }

    // Text message
    if (msg.type === "text" || !msg.file) {
      return (
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap wrap-break-words text-[#E9EDEF]">
          {msg.text}
        </p>
      );
    }

    // Media (Photo, Video, Audio, File)
    const isLocalPreview = Boolean(msg.file?.data);
    const mediaUrl = isLocalPreview ? msg.file.data : `${API}${msg.file.url}`;

    if (msg.type === "image") {
      return (
        <div className="space-y-1">
          <img
            src={mediaUrl}
            alt={msg.file.name || "Photo"}
            className="rounded-lg max-w-xs md:max-w-sm max-h-72 object-cover cursor-pointer hover:opacity-95 transition"
            onClick={() => window.open(mediaUrl, "_blank")}
          />
          {msg.text && (
            <p className="text-[14px] leading-relaxed text-[#E9EDEF] mt-1">
              {msg.text}
            </p>
          )}
        </div>
      );
    }

    if (msg.type === "video") {
      return (
        <div className="space-y-1">
          <video
            controls
            src={mediaUrl}
            className="rounded-lg max-w-xs md:max-w-sm max-h-72 bg-black"
          />
          {msg.text && (
            <p className="text-[14px] leading-relaxed text-[#E9EDEF] mt-1">
              {msg.text}
            </p>
          )}
        </div>
      );
    }

    if (msg.type === "audio") {
      return (
        <div className="space-y-1">
          <audio controls src={mediaUrl} className="max-w-xs h-9" />
          {msg.text && (
            <p className="text-[14px] leading-relaxed text-[#E9EDEF] mt-1">
              {msg.text}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          download={msg.file.name}
          className="flex items-center gap-3 p-2 rounded-md bg-[#182229] border border-[#2A3942] hover:bg-[#202C33] transition"
        >
          <div className="w-8 h-8 rounded bg-[#202C33] flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-[#00A884]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#E9EDEF] truncate">
              {msg.file.name}
            </p>
            <p className="text-[10px] text-[#8696A0]">
              {msg.file.size ? `${(msg.file.size / 1024).toFixed(0)} KB` : "File"}
            </p>
          </div>
          <Download className="w-4 h-4 shrink-0 text-[#8696A0]" />
        </a>
        {msg.text && (
          <p className="text-[14px] leading-relaxed text-[#E9EDEF] mt-1">
            {msg.text}
          </p>
        )}
      </div>
    );
  };

  /* ================= UI LAYOUT ================= */
  return (
    <div className="flex-1 relative flex flex-col h-full bg-[#0B141A] min-w-0 overflow-hidden">
      {/* WHATSAPP DOODLE WALLPAPER LAYER */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60 bg-repeat bg-center z-0"
        style={{
          backgroundImage: "url('/bg-canvas.jpg')",
          backgroundSize: "412px",
        }}
      />

      {/* HEADER */}
      {chat && headerUser ? (
        <div className="h-[60px] px-4 bg-[#202C33] flex items-center justify-between z-10 shrink-0 border-l border-[#222D34]">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={getAvatar(headerUser.avatar)}
              alt={headerUser.displayName || "Avatar"}
              className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_AVATAR;
              }}
            />

            <div className="min-w-0">
              <h2 className="text-[16px] font-normal text-[#E9EDEF] truncate">
                {headerUser._id === user?._id
                  ? `${headerUser.displayName} (You)`
                  : headerUser.displayName}
              </h2>
              <p className="text-[13px] leading-tight text-[#8696A0] truncate">
                {headerUser._id === user?._id || headerUser.isActive ? (
                  <span className="text-[#00A884]">online</span>
                ) : (
                  formatLastSeen(headerUser.lastSeen)
                )}
              </p>
            </div>
          </div>

          {/* RIGHT ACTION ICONS */}
          <div className="flex items-center gap-2 text-[#AEBAC1]">
            <button
              type="button"
              title="Search in chat"
              className="p-2 hover:bg-[#374248] hover:text-[#E9EDEF] rounded-full transition cursor-pointer"
            >
              <Search className="w-5 h-5 stroke-[1.8]" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Menu"
                  className="p-2 hover:bg-[#374248] hover:text-[#E9EDEF] rounded-full transition cursor-pointer"
                >
                  <MoreVertical className="w-5 h-5 stroke-[1.8]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-[#233138] border border-[#233138] text-[#D1D7DB] shadow-2xl rounded p-1 min-w-[150px]"
              >
                <DropdownMenuItem
                  onClick={() => setMessages([])}
                  className="cursor-pointer hover:bg-[#182229] px-3 py-2 text-sm text-[#E9EDEF]"
                >
                  Clear messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : null}

      {/* MESSAGES OR WHATSAPP EMPTY STATE */}
      {!chat ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 z-10 select-none bg-transparent text-[#8696A0]">
          <div className="w-20 h-20 rounded-full bg-[#202C33] flex items-center justify-center text-4xl mb-6 shadow-md border border-[#2A3942]">
            🐥
          </div>
          <h2 className="text-2xl font-light text-[#E9EDEF] mb-2 tracking-wide">
            Chirp for Desktop
          </h2>
          <p className="text-sm text-[#8696A0] max-w-sm leading-relaxed mb-8">
            Send and receive messages with low latency. Share photos, audio, and documents in real time.
          </p>
          <div className="flex items-center gap-2 text-xs text-[#8696A0]">
            <Lock className="w-3.5 h-3.5 text-[#00A884]" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      ) : (
        <div className="relative z-1 flex-1 overflow-y-auto px-4 md:px-14 py-4 space-y-2">
          {/* ENCRYPTION PILL AT TOP OF CHAT */}
          <div className="flex justify-center my-2">
            <div className="bg-[#182229] border border-[#2A3942]/60 rounded-lg px-3 py-1.5 max-w-md text-center shadow-xs flex items-center gap-2 text-[12px] text-[#FFE79A]/90">
              <ShieldCheck className="w-4 h-4 text-[#FFE79A] shrink-0" />
              <span>
                Messages are end-to-end encrypted. No one outside of this chat can read them.
              </span>
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center text-[#8696A0] select-none">
              <div className="w-12 h-12 rounded-full bg-[#202C33] flex items-center justify-center text-2xl mb-3 shadow">
                👋
              </div>
              <p className="text-sm text-[#E9EDEF] font-medium">No messages yet</p>
              <p className="text-xs text-[#8696A0] mt-1">
                Say hello to start the conversation!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const mine = isMe(msg);

              return (
                <div
                  key={msg.id}
                  className={`group flex items-end gap-1 ${
                    mine ? "justify-end" : "justify-start"
                  }`}
                >
                  {mine && !msg.deleted && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete message"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#8696A0] hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  {/* EXACT WHATSAPP MESSAGE BUBBLES */}
                  <div
                    className={`px-3 py-1.5 rounded-lg shadow-sm max-w-[70%] md:max-w-[65%] min-w-[75px] ${
                      mine
                        ? "bg-[#005C4B] text-[#E9EDEF] rounded-tr-none"
                        : "bg-[#202C33] text-[#E9EDEF] rounded-tl-none"
                    }`}
                  >
                    {renderMessageBody(msg)}

                    <div className="flex items-center justify-end gap-1 text-[11px] text-[#ffffff99] mt-0.5 leading-none">
                      <span>{formatMsgTime(msg.timestamp)}</span>
                      {mine && !msg.deleted && (
                        <span className="inline-flex">
                          {msg.status === "read" ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                          ) : msg.status === "delivered" ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#ffffff99]" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-[#ffffff99]" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* PENDING FILE PREVIEW */}
      {pendingFile && (
        <div className="px-4 py-2 bg-[#182229] border-t border-[#222D34] flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#202C33] flex items-center justify-center text-[#00A884]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#E9EDEF] font-medium truncate max-w-xs">
                {pendingFile.name}
              </p>
              <p className="text-[11px] text-[#8696A0]">
                {pendingFile.size} MB
              </p>
            </div>
          </div>
          <button
            onClick={() => setPendingFile(null)}
            className="p-1 text-[#8696A0] hover:text-[#E9EDEF]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* INPUT BAR */}
      {chat && (
        <div className="min-h-[62px] px-4 py-2 bg-[#202C33] flex items-center gap-3 z-10 shrink-0">
          <button
            type="button"
            className="text-[#8696A0] hover:text-[#E9EDEF] transition p-1 cursor-pointer"
          >
            <Smile className="w-6 h-6 stroke-[1.8]" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach photo, video or audio"
            className="text-[#8696A0] hover:text-[#E9EDEF] transition p-1 cursor-pointer"
          >
            <Paperclip className="w-6 h-6 stroke-[1.8]" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileSelect}
          />

          <form
            onSubmit={handleSendMessage}
            className="flex-1 flex items-center gap-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type a message"
              className="w-full h-10 px-4 bg-[#2A3942] text-[#E9EDEF] placeholder:text-[#8696A0] rounded-lg text-[15px] outline-none"
            />

            {input.trim() || pendingFile ? (
              <button
                type="submit"
                className="text-[#00A884] hover:text-[#06cf9c] transition p-1 cursor-pointer"
                title="Send"
              >
                <Send className="w-6 h-6 stroke-[1.8]" />
              </button>
            ) : (
              <button
                type="button"
                className="text-[#8696A0] hover:text-[#E9EDEF] transition p-1 cursor-pointer"
                title="Voice note"
              >
                <Mic className="w-6 h-6 stroke-[1.8]" />
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
