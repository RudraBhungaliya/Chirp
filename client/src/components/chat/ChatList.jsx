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
        className="h-full border-r bg-[#0B141A] flex flex-col text-white"
      >
        <div className="px-3 py-2 bg-[#0B141A]">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696A0]">
              🔍
            </span>

            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="
        h-11
        pl-11 pr-10
        rounded-full
        bg-[#202C33]
        text-[#E9EDEF]
        placeholder:text-[#8696A0]
        border-none
        shadow-inner
        focus-visible:ring-0
        focus-visible:ring-offset-0
      "
            />

            {search.length > 0 && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8696A0] hover:text-[#E9EDEF] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Chat list / empty state */}
        <div className="flex-1 flex">
          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-[#8696A0] text-sm">No chats found</div>
              <div className="text-[#8696A0] text-xs mt-1">
                Try a different name
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filtered.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b hover:bg-[#202C33]
                    ${
                      selectedChat?.id === chat.id
                        ? "bg-[#202C33]"
                        : "bg-[#111B21]"
                    }`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#2A3942] flex items-center justify-center">
                    <img
                      src="/default-avatar.jpeg"
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <span className="font-medium">{chat.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <div
        onMouseDown={() => (resizing.current = true)}
        className="w-[4px] cursor-col-resize bg-black hover:bg-black/80"
      />
    </>
  );
}
