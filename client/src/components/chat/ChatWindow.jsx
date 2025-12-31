import { useEffect, useState, useRef } from "react";
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

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function ChatWindow({ chat, user }) {
  const { token } = useAuth();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState(null);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileTypeRef = useRef("document");

  const API = import.meta.env.VITE_API_URL;

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!chat) {
      setMessages([]);
      return;
    }

    fetch(`${API}/api/message/${chat._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((msgs) =>
        setMessages(
          msgs.map((m) => ({
            id: m._id,
            senderId: m.sender._id,
            senderName: m.sender.displayName,
            senderAvatar: m.sender.avatar,
            type: m.type,
            text: m.content,
            file: m.file,
            deleted: m.deleted,
            timestamp: new Date(m.createdAt).getTime(),
          }))
        )
      );
  }, [chat, token]);

  /* ================= SOCKET ================= */

  useEffect(() => {
    if (!chat || !token) return;

    if (!socketRef.current) {
      socketRef.current = connectSocket(token);
    }

    const socket = socketRef.current;
    socket.emit("join_chat", chat._id);

    socket.on("new_message", (m) => {
      setMessages((prev) => [
        ...prev,
        {
          id: m._id,
          senderId: m.sender._id,
          senderName: m.sender.displayName,
          senderAvatar: m.sender.avatar,
          type: m.type,
          text: m.content,
          file: m.file,
          deleted: m.deleted,
          timestamp: new Date(m.createdAt).getTime(),
        },
      ]);
    });

    return () => socket.off("new_message");
  }, [chat, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  /* ================= SEND ================= */

  const sendText = async () => {
    if (!input.trim()) return;

    const msg = {
      id: crypto.randomUUID(),
      senderId: user._id,
      senderName: user.displayName,
      senderAvatar: user.avatar,
      type: "text",
      text: input,
      file: null,
      deleted: false,
      timestamp: Date.now(),
    };

    await pushMessage(msg);

    setInput("");
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File too large");
      return;
    }

    const base64 = await fileToBase64(file);

    const msg = {
      id: crypto.randomUUID(),
      senderId: user._id,
      senderName: user.displayName,
      senderAvatar: user.avatar,
      type: fileTypeRef.current,
      text: "",
      file: { name: file.name, data: base64, mime: file.type },
      deleted: false,
      timestamp: Date.now(),
    };

    await pushMessage(msg);

    e.target.value = "";
  };

  /* ================= HELPERS ================= */

  const pushMessage = async (msg) => {
    if (!chat) return;

    // show locally
    setMessages((prev) => [...prev, msg]);

    try {
      const body = {
        content: msg.text || "",
        type: msg.type || "text",
        file: msg.file
          ? { name: msg.file.name, data: msg.file.data, mime: msg.file.mime }
          : undefined,
      };

      const res = await fetch(`${API}/api/message/${chat._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const saved = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.timestamp === msg.timestamp ? { ...m, id: saved._id } : m))
        );
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const isMe = (msg) => !!user && msg.senderId === user._id;

  const formatTime = (ts) =>
    ts
      ? new Date(ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const getHeaderUser = () => {
    if (!chat) return null;
    if (chat.participants.every((p) => p._id === user._id)) return user;
    return chat.participants.find((p) => p._id !== user._id);
  };

  const headerUser = getHeaderUser();

  /* ================= RENDER MESSAGE ================= */

  const renderMessage = (msg) => {
    if (msg.deleted) return <i>Message deleted</i>;

    if (msg.type === "text") return msg.text;

    if (!msg.file?.url) return "[File missing]";

    const url = `${API}${msg.file.url}`;

    if (msg.type === "image")
      return <img src={url} className="rounded-lg max-w-[360px]" />;

    if (msg.type === "video")
      return <video controls src={url} className="max-w-[400px]" />;

    if (msg.type === "audio")
      return <audio controls src={url} />;

    return (
      <a href={url} target="_blank" rel="noreferrer">
        {msg.file.name}
      </a>
    );
  };

  /* ================= UI ================= */

  return (
    <div className="flex-1 flex flex-col bg-[#0B141A]">
      {/* HEADER */}
      <div className="h-14 flex items-center gap-3 px-4 border-b text-white">
        {chat ? (
          headerUser && (
            <>
              <img
                src={headerUser.avatar || "/default-avatar.jpeg"}
                className="w-9 h-9 rounded-full object-cover"
              />
              <span>
                {headerUser._id === user?._id
                  ? `${headerUser.displayName} (You)`
                  : headerUser.displayName}
              </span>
            </>
          )
        ) : (
          <div className="font-semibold">Chirp</div>
        )}
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!chat ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/90">
            <div className="text-4xl mb-4">🐥</div>
            <h2 className="text-2xl font-semibold">Chirp for Desktop</h2>
            <p className="text-gray-400 mt-2">Messages are end-to-end encrypted.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-3 flex ${isMe(msg) ? "justify-end" : "justify-start"}`}
            >
              {!isMe(msg) && (
                <img
                  src={msg.senderAvatar || "/default-avatar.png"}
                  className="w-8 h-8 rounded-full mr-2"
                />
              )}
              <div
                className={`px-3 py-2 rounded-xl max-w-[70%] ${
                  isMe(msg) ? "bg-[#145C44] text-white" : "bg-white text-black"
                }`}
              >
                <div>{renderMessage(msg)}</div>
                <div className={`text-xs mt-1 ${isMe(msg) ? "text-white/70 text-right" : "text-gray-500"}`}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      {chat && (
        <div className="h-16 flex items-center px-3 bg-black">
          <button
            onClick={() => fileInputRef.current.click()}
            className="text-white text-xl"
          >
            +
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            className="flex-1 bg-transparent text-white px-3 outline-none"
            placeholder="Type a message"
          />

          <button onClick={sendText} className="text-white">
            ➤
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
