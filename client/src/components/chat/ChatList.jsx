import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export default function ChatList({
  selectedChat,
  onSelectChat,
  chats = [],
  currentUserId,
  currentUser,
  onRequireAuth,
}) {
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(360);
  const resizing = useRef(false);

  const filtered = chats
    .map((chat) => {
      const displayUser =
        chat.participants?.find((p) => p._id !== currentUserId) ||
        chat.participants?.find((p) => p._id === currentUserId) ||
        null;

      return { ...chat, displayUser };
    })
    .filter((chat) =>
      chat.displayUser?.displayName
        ?.toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;

      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;

      if (timeA !== timeB) return timeB - timeA;

      const nameA = a.displayUser?.displayName || "";
      const nameB = b.displayUser?.displayName || "";

      return nameA.localeCompare(nameB, undefined, {
        sensitivity: "base",
      });
    });

  useEffect(() => {
    const move = (e) => {
      if (!resizing.current) return;
      setWidth(Math.min(520, Math.max(260, e.clientX)));
    };

    const up = () => {
      resizing.current = false;
    };

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
        <div className="px-3 py-2">
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

            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8696A0] hover:text-[#E9EDEF]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-[#8696A0] text-sm">No chats found</div>
              <div className="text-[#8696A0] text-xs mt-1">
                Try a different name
              </div>
            </div>
          ) : (
            filtered.map((chat) => {
              const displayUser = chat.displayUser;
              const isSelfChat = displayUser?._id === currentUserId;

              return (
                <div
                  key={chat._id}
                  onClick={() => onSelectChat(chat)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#202C33]
                    ${
                      selectedChat?._id === chat._id
                        ? "bg-[#202C33]"
                        : "bg-[#111B21] hover:bg-[#202C33]"
                    }`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#2A3942]">
                    <img
                      src={displayUser?.avatar || "/default-avatar.jpeg"}
                      onError={(e) => {
                        e.currentTarget.src = "/default-avatar.jpeg";
                      }}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#E9EDEF] truncate">
                      {isSelfChat
                        ? "Saved Messages"
                        : displayUser?.displayName || "Unknown"}
                    </div>

                    {chat.lastMessage && (
                      <div className="text-xs text-[#8696A0] truncate">
                        {chat.lastMessage.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[#202C33] px-4 py-3">
          {!currentUser ? (
            <button
              onClick={onRequireAuth}
              className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#202C33]"
            >
              <div className="w-10 h-10 rounded-full bg-[#2A3942] flex items-center justify-center">
                👤
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">Login to Chirp</div>
                <div className="text-xs text-[#8696A0]">
                  Sign in to start chatting
                </div>
              </div>
            </button>
          ) : (
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#202C33]">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2A3942]">
                <img
                  src={currentUser.avatar || "/default-avatar.jpeg"}
                  onError={(e) => {
                    e.currentTarget.src = "/default-avatar.jpeg";
                  }}
                  alt="profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">
                  {currentUser.displayName || "You"}
                </div>
                <div className="text-xs text-[#8696A0]">View profile</div>
              </div>
            </button>
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
