import { useEffect, useState, useRef } from "react";
import localforage from "localforage";

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

export default function ChatWindow({ chat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const bottomRef = useRef(null);

  const fileInputRef = useRef(null);
  const fileTypeRef = useRef("document");

  useEffect(() => {
    if (!chat) {
      setMessages([]);
      return;
    }
    localforage.getItem(`messages:${chat.id}`).then((m) => {
      const normalized = (m || []).map((msg) => ({
        ...msg,
        sender: msg.sender ?? "me",
      }));
      setMessages(normalized);
    });
  }, [chat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const pushMessage = async (msg) => {
    const updated = [...messages, msg];
    setMessages(updated);
    await localforage.setItem(`messages:${chat.id}`, updated);
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
    const updated = messages.map((m) =>
      m.id === id ? { ...m, deleted: true, text: "", file: null } : m
    );
    setMessages(updated);
    await localforage.setItem(`messages:${chat.id}`, updated);
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
        <span className="italic text-gray-500">You deleted this message</span>
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
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 max-w-[280px]">
        <div className="text-2xl">📄</div>

        <div className="flex-1 overflow-hidden">
          <div className="text-sm font-medium truncate">{msg.file.name}</div>
          <div className="text-xs text-gray-500">Click to open</div>
        </div>

        <a
          href={blobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 text-sm hover:underline"
        >
          Open
        </a>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#E4E6EB]">
      <div
        className="h-14 border-b bg-[#E4E6EB] flex items-center gap-3 px-4 font-semibold
                sticky top-0 z-50 shadow-md"
      >
        {chat ? (
          <>
            <div className="w-9 h-9 rounded-full bg-[#E4E6EB] flex items-center justify-center border border-black/40">
              {(chat.name || "?")[0]}
            </div>

            {chat.name || "Unknown"}
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
              <h2 className="text-2xl font-semibold">Chirp for Desktop</h2>
              <p className="text-gray-500">
                Messages are end-to-end encrypted.
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 px-6 py-4 overflow-y-auto">
            {messages.map((msg) => {
              const isMe = msg.sender === "me";

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
                      <div
                        className={`relative px-3 py-2 rounded-xl text-sm max-w-[70%] shadow-sm
    ${
      msg.deleted
        ? "bg-white text-gray-500"
        : msg.type === "text"
        ? isMe
          ? "bg-[#25D366] text-white"
          : "bg-white text-black"
        : "bg-white text-black p-1"
    }`}
                      >
                        {renderMessage(msg)}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
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
        <div className="h-14 border-t bg-white flex items-center gap-2 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full hover:bg-[#E4E6EB]">
                ＋
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
            className="flex-1 h-9 px-3 rounded-md border outline-none"
          />

          <button
            onClick={sendText}
            className="px-4 py-2 rounded-md bg-[#25D366] hover:bg-[#1DA851] text-white"
          >
            Send
          </button>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileSelect}
          />
        </div>
      )}
    </div>
  );
}
