import { useEffect, useState, useRef } from "react";
import localforage from "localforage";
import { connectSocket } from "../../services/socket";
import { useAuth } from "../../context/authContext";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_FILE_SIZE = 350 * 1024 * 1024;

const FILE_RULES = {
  image: ["image/"],
  video: ["video/"],
  audio: ["audio/"],
  document: [],
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const base64ToBlobUrl = (base64, mime) => {
  if (!base64 || typeof base64 !== "string" || !base64.includes(",")) {
    return null;
  }

  const byteString = atob(base64.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([ab], { type: mime || "application/octet-stream" });
  return URL.createObjectURL(blob);
};

export default function ChatWindow({ chat, user, onRequireAuth }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  const fileInputRef = useRef(null);
  const fileTypeRef = useRef("document");

  useEffect(() => {
    if (!chat) {
      setMessages([]);
      return;
    }

    // Fetch messages from backend
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/message/${chat._id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.ok) {
          const msgs = await res.json();
          const normalized = msgs.map((msg) => ({
            id: msg._id,
            sender: msg.sender._id === user._id ? "me" : msg.sender._id,
            senderName: msg.sender.displayName,
            senderAvatar: msg.sender.avatar,
            type: msg.type,
            text: msg.content,
            file: msg.file,
            deleted: msg.deleted,
            timestamp: new Date(msg.createdAt).getTime(),
            seen: true,
            createdAt: msg.createdAt,
          }));
          setMessages(normalized);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [chat, token, user]);

  // Socket.io setup for real-time messages
  useEffect(() => {
    if (!token || !chat) return;

    if (!socketRef.current) {
      socketRef.current = connectSocket(token);
    }

    const socket = socketRef.current;

    // Join the chat room
    socket.emit("join_chat", chat._id);

    // Listen for new messages
    socket.on("new_message", (message) => {
      const normalized = {
        id: message._id,
        sender: message.sender._id === user._id ? "me" : message.sender._id,
        senderName: message.sender.displayName,
        senderAvatar: message.sender.avatar,
        type: message.type,
        text: message.content,
        file: message.file,
        deleted: message.deleted,
        timestamp: new Date(message.createdAt).getTime(),
        seen: true,
        createdAt: message.createdAt,
      };
      setMessages((prev) => [...prev, normalized]);
    });

    return () => {
      socket.off("new_message");
    };
  }, [chat, token, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const pushMessage = async (msg) => {
    if (!chat) return;

    try {
      setMessages((prev) => [...prev, msg]);

      // Send to backend
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/message/${chat._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: msg.text,
            type: msg.type,
            file: msg.file,
          }),
        }
      );

      if (res.ok) {
        const savedMsg = await res.json();
        // Update the message with server id
        setMessages((prev) =>
          prev.map((m) =>
            m.timestamp === msg.timestamp
              ? { ...m, id: savedMsg._id }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const sendText = async () => {
    if (!input.trim() || !chat) return;

    await pushMessage({
      id: crypto.randomUUID(),
      sender: "me",
      type: "text",
      text: input,
      file: null,
      deleted: false,
      seen: false,
      timestamp: Date.now(),
    });

    setInput("");
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !chat) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File too large. Max 350MB allowed.");
      e.target.value = "";
      return;
    }

    const allowed = FILE_RULES[fileTypeRef.current];
    if (allowed.length && !allowed.some((p) => file.type.startsWith(p))) {
      alert(`Please select a ${fileTypeRef.current} file`);
      e.target.value = "";
      return;
    }

    const base64 = await fileToBase64(file);

    await pushMessage({
      id: crypto.randomUUID(),
      sender: "me",
      type: fileTypeRef.current,
      text: "",
      file: {
        name: file.name,
        data: base64,
        mime: file.type,
      },
      deleted: false,
      seen: false,
      timestamp: Date.now(),
    });

    e.target.value = "";
  };

  const formatTime = (ts) =>
    ts
      ? new Date(ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const deleteMessage = async (id) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/message/${chat._id}/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, deleted: true, text: "", file: null } : m
          )
        );
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  useEffect(() => {
    if (!chat || messages.length === 0) return;

    let changed = false;

    const updated = messages.map((m) => {
      if (m.sender === "me" && m.seen === false) {
        changed = true;
        return { ...m, seen: true };
      }
      return m;
    });

    if (changed) {
      setMessages(updated);
      localforage.setItem(`message:${chat.id}`, updated);
    }
  }, [chat]);

  const renderMessage = (msg) => {
    if (msg.deleted)
      return (
        <span className="italic text-white">You deleted this message</span>
      );

    if (msg.type === "text") return msg.text;

    if (!msg.file) return "Unsupported message";

    if (msg.type === "image") {
      const blobUrl = base64ToBlobUrl(msg.file?.data, msg.file?.mime);
      if (!blobUrl)
        return <span className="text-gray-400">[Broken image]</span>;

      return (
        <a href={blobUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={blobUrl}
            className="rounded-lg max-w-[360px] max-h-[260px] object-cover"
          />
        </a>
      );
    }

    if (msg.type === "video")
      return (
        <video
          controls
          className="rounded-lg max-w-[400px] max-h-[350px] bg-black"
        >
          <source src={msg.file.data} />
        </video>
      );

    if (msg.type === "audio")
      return (
        <audio controls>
          <source src={msg.file.data} />
        </audio>
      );

    const blobUrl = base64ToBlobUrl(msg.file?.data, msg.file?.mime);
    if (!blobUrl)
      return <span className="text-gray-400">[Broken attachment]</span>;

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg max-w-[280px] bg-transparent">
        <div className="text-2xl text-white/90">📄</div>

        <div className="flex-1 overflow-hidden">
          <div className="text-sm font-medium truncate text-white">
            {msg.file.name}
          </div>
          <div className="text-xs text-white/70">Click to open</div>
        </div>

        <a
          href={blobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-medium text-sm hover:underline"
        >
          Open
        </a>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0B141A]">
      <div
        className="h-14 border-b bg-[#0B141A] flex items-center gap-3 px-4 font-semibold
                sticky top-0 z-50 shadow-md text-white"
      >
        {chat ? (
          <>
            <div className="w-9 h-9 rounded-full overflow-hidden bg-[#2A3942] border border-black/40">
              {chat.participants && chat.participants.length > 0 ? (
                <img
                  src={
                    chat.participants.find((p) => p._id !== user._id)
                      ?.avatar || "/default-avatar.jpeg"
                  }
                  alt="avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = "/default-avatar.jpeg";
                  }}
                />
              ) : (
                <img
                  src="/default-avatar.jpeg"
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {chat.participants
              ? chat.participants
                  .filter((p) => p._id !== user._id)
                  .map((p) => p.displayName)
                  .join(", ") || "Unknown"
              : "Unknown"}
          </>
        ) : (
          "Chirp"
        )}
      </div>

      <div className="flex-1 relative">
        {!chat ? (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <div className="text-4xl mb-4">🐥</div>
              <h2 className="text-2xl text-white font-semibold">
                Chirp for Desktop
              </h2>
              <p className="text-gray-400">
                Messages are end-to-end encrypted.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="absolute inset-0 px-6 py-4 overflow-y-auto rounded-t-xl
             bg-[url('/bg-canvas.jpg')]
             bg-repeat bg-center bg-[length:420px]"
            onContextMenu={(e) => e.preventDefault()}
          >
            {messages.map((msg) => {
              const isMe = msg.sender === "me";
              const senderName = isMe ? "You" : "User";

              return (
                <DropdownMenu
                  key={msg.id}
                  open={menuOpenFor === msg.id}
                  onOpenChange={(o) => !o && setMenuOpenFor(null)}
                >
                  <DropdownMenuTrigger asChild>
                    <div
                      className={`mb-3 flex ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!msg.deleted) setMenuOpenFor(msg.id);
                      }}
                    >
                      {!isMe && (
                        <img
                          src={msg.senderAvatar || "/default-avatar.png"}
                          alt="avatar"
                          className="w-8 h-8 rounded-full object-cover mr-2 mt-1"
                          onError={(e) => {
                            e.target.src = "/default-avatar.png";
                          }}
                        />
                      )}
                      <div
                        className={`relative px-3 py-2 rounded-xl text-sm max-w-[70%] shadow-sm
${
  msg.deleted
    ? "bg-[#145C44] text-white"
    : isMe
    ? "bg-[#145C44] text-white"
    : "bg-white text-black"
}
${msg.type !== "text" ? " p-1" : ""}
`}
                      >
                        {renderMessage(msg)}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white opacity-80">
                          <span>{formatTime(msg.timestamp)}</span>

                          {msg.sender === "me" && (
                            <span>{msg.seen ? "✓✓" : "✓"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuTrigger>

                  {!msg.deleted && (
                    <DropdownMenuContent align="end">
                      {msg.type === "text" && (
                        <DropdownMenuItem
                          onClick={() =>
                            navigator.clipboard.writeText(msg.text)
                          }
                        >
                          Copy
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {chat && (
        <div className="h-16 bg-black flex items-center px-3">
          <div className="flex items-center gap-2 w-full bg-[#202C33] rounded-full px-3 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 rounded-full text-white hover:bg-white/10 flex items-center justify-center text-xl">
                  +
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="start">
                {[
                  ["document", "📄 Document"],
                  ["image", "🖼 Image"],
                  ["video", "🎥 Video"],
                  ["audio", "🎧 Audio"],
                ].map(([type, label]) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => {
                      fileTypeRef.current = type;
                      fileInputRef.current.click();
                    }}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              placeholder="Type a message"
              className="flex-1 bg-transparent text-white placeholder:text-white/60 outline-none px-2 text-sm"
            />

            <button
              onClick={sendText}
              className="w-10 h-10 rounded-full bg-wa hover:bg-wa/90 text-white flex items-center justify-center"
            >
              ➤
            </button>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}
