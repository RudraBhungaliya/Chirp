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

export default function ChatWindow({ chat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const bottomRef = useRef(null);

  const fileInputRef = useRef(null);
  const fileTypeRef = useRef("document");

  /* LOAD */
  useEffect(() => {
    if (!chat) {
      setMessages([]);
      return;
    }
    localforage.getItem(`messages:${chat.id}`).then((m) => {
      const normalized = (m || []).map((msg) => ({
        sender: "me",
        ...msg,
      }));
      setMessages(normalized);
    });
  }, [chat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  /* CORE PUSH */
  const pushMessage = async (msg) => {
    const updated = [...messages, msg];
    setMessages(updated);
    await localforage.setItem(`messages:${chat.id}`, updated);
  };

  /* TEXT */
  const sendText = async () => {
    if (!input.trim() || !chat) return;

    await pushMessage({
      id: crypto.randomUUID(),
      sender: "me",
      type: "text",
      text: input,
      file: null,
      deleted: false,
      timestamp: Date.now(),
    });

    setInput("");
  };

  /* FILE */
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
      timestamp: Date.now(),
    });

    e.target.value = "";
  };

  /* DELETE */
  const deleteMessage = async (id) => {
    const updated = messages.map((m) =>
      m.id === id ? { ...m, deleted: true, text: "", file: null } : m
    );
    setMessages(updated);
    await localforage.setItem(`messages:${chat.id}`, updated);
  };

  const renderMessage = (msg) => {
    if (msg.deleted) return "This message was deleted";

    if (msg.type === "text") {
      return msg.text;
    }

    if (!msg.file) {
      return "Unsupported message";
    }

    if (msg.type === "image") {
      return (
        <img
          src={msg.file.data}
          alt={msg.file.name}
          className="rounded-md max-w-full"
        />
      );
    }

    if (msg.type === "video") {
      return (
        <video controls className="rounded-md max-w-full">
          <source src={msg.file.data} type={msg.file.mime} />
        </video>
      );
    }

    if (msg.type === "audio") {
      return (
        <audio controls>
          <source src={msg.file.data} type={msg.file.mime} />
        </audio>
      );
    }

    return (
      <a href={msg.file.data} download={msg.file.name} className="underline">
        📄 {msg.file.name}
      </a>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="h-14 border-b flex items-center gap-3 px-4 font-semibold">
        {chat ? (
          <>
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              {chat.name[0]}
            </div>
            {chat.name}
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
              <p className="text-muted-foreground">
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
                        className={`px-3 py-2 rounded-lg text-sm max-w-[70%]
              ${
                msg.deleted
                  ? "bg-muted text-muted-foreground italic"
                  : isMe
                  ? "bg-green-600 text-white"
                  : "bg-muted"
              }`}
                      >
                        {renderMessage(msg)}
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
        <div className="h-14 border-t flex items-center gap-2 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full hover:bg-muted">
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
            className="px-4 py-2 rounded-md bg-green-600 text-white"
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
