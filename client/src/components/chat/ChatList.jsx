import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export default function ChatList({ selectedChat, onSelectChat }) {
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(360);
  const resizing = useRef(false);

  const chats = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" },
  ];

  const filtered = chats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const move = (e) => {
      if (!resizing.current) return;
      setWidth(Math.min(520, Math.max(260, e.clientX)));
    };
    const up = () => (resizing.current = false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  return (
    <>
      <aside
        style={{ width }}
        className="h-full border-r bg-background flex flex-col"
      >
        <div className="p-3 relative">
          <Input
            placeholder="Search chats"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
          {search.length > 1 && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b
                ${selectedChat?.id === chat.id ? "bg-muted" : ""}`}
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-semibold">
                {chat.name[0]}
              </div>
              <span className="font-medium">{chat.name}</span>
            </div>
          ))}
        </div>
      </aside>

      <div
        onMouseDown={() => (resizing.current = true)}
        className="w-[4px] cursor-col-resize bg-border"
      />
    </>
  );
}
