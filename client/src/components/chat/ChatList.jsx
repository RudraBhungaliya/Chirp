import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ChatList({
  selectedChat,
  onSelectChat,
  onSelectUser,
  users = [],
  chats = [],
  currentUserId,
  currentUser,
  onRequireAuth,
  onEditProfile,
  onLogout,
}) {
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(360);
  const resizing = useRef(false);

  const filteredChats = chats
    .map((chat) => {
      const displayUser =
        chat.participants?.find((p) => p._id !== currentUserId) || null;

      return { ...chat, displayUser };
    })
    .filter((chat) =>
      chat.displayUser?.displayName
        ?.toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const tA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const tB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;

      if (tA !== tB) return tB - tA;

      return (a.displayUser?.displayName || "").localeCompare(
        b.displayUser?.displayName || "",
        undefined,
        { sensitivity: "base" }
      );
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
        {/* SEARCH */}
        <div className="px-3 py-2">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696A0]">
              🔍
            </span>

            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-11 pr-10 rounded-full bg-[#202C33]
                         text-[#E9EDEF] placeholder:text-[#8696A0]
                         border-none focus-visible:ring-0"
            />
          </div>
        </div>

        {/* USERS (START NEW CHAT) */}
        {users.length > 0 && (
          <div className="border-b border-[#202C33]">
            {users
              .filter(
                (u) =>
                  u._id !== currentUserId &&
                  u.displayName?.toLowerCase().includes(search.toLowerCase())
              )
              .map((u) => (
                <div
                  key={u._id}
                  onClick={() => onSelectUser(u)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer
                             hover:bg-[#202C33]"
                >
                  <img
                    src={u.avatar || "/default-avatar.jpeg"}
                    alt={u.displayName}
                    className="w-9 h-9 rounded-full object-cover"
                    onError={(e) => {
                      e.target.src = "/default-avatar.jpeg";
                    }}
                  />
                  <div className="font-medium">{u.displayName}</div>
                </div>
              ))}
          </div>
        )}

        {/* CHATS */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-[#8696A0] text-sm">No chats found</div>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = selectedChat?._id === chat._id;
              const displayUser = chat.displayUser;

              return (
                <div
                  key={chat._id}
                  onClick={() => onSelectChat(chat)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer
                    border-b border-[#202C33]
                    ${
                      isSelected
                        ? "bg-[#202C33]"
                        : "bg-[#111B21] hover:bg-[#202C33]"
                    }`}
                >
                  <img
                    src={displayUser?.avatar || "/default-avatar.jpeg"}
                    alt={displayUser?.displayName}
                    className="w-9 h-9 rounded-full object-cover"
                    onError={(e) => {
                      e.target.src = "/default-avatar.jpeg";
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {displayUser?.displayName || "Unknown"}
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

        {/* FOOTER */}
        <div className="border-t border-[#202C33] px-4 py-3">
          {!currentUser ? (
            <button
              onClick={onRequireAuth}
              className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#202C33]"
            >
              👤 Login to Chirp
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#202C33]">
                  <img
                    src={currentUser.avatar || "/default-avatar.jpeg"}
                    alt={currentUser.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.target.src = "/default-avatar.jpeg";
                    }}
                  />
                  <div className="text-left">
                    <div className="text-sm font-medium">
                      {currentUser.displayName}
                    </div>
                    <div className="text-xs text-[#8696A0]">
                      @{currentUser.userName}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditProfile}>
                  ✎ Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="text-red-500">
                  ⊗ Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      <div
        onMouseDown={() => (resizing.current = true)}
        className="w-[4px] cursor-col-resize bg-black"
      />
    </>
  );
}
