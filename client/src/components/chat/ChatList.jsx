import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return "offline";

  const now = new Date();
  const last = new Date(lastSeen);
  const diffMs = now - last;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 0.2) return "active now";
  if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return last.toLocaleDateString();
};

export default function ChatList({
  onSelectUser,
  users = [],
  chats = [],
  currentUser,
  onRequireAuth,
  onEditProfile,
  onLogout,
}) {
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(360);
  const resizing = useRef(false);

  const currentUserId = currentUser?._id;

  const sidebarItems = (users || [])
    .map((u) => {
      const isSelf = currentUserId ? u._id === currentUserId : false;

      const chat = (chats || []).find((c) => {
        if (!c || !c.participants) return false;
        const ids = c.participants.map((p) =>
          typeof p === "string" ? p : p?._id
        );

        if (isSelf) {
          return ids.length === 1 && ids[0] === currentUserId;
        }

        return (
          Boolean(currentUserId) &&
          ids.length === 2 &&
          ids.includes(currentUserId) &&
          ids.includes(u._id)
        );
      });

      return {
        user: u,
        chat: chat || null,
        lastMessage: chat?.lastMessage || null,
        updatedAt:
          chat?.lastMessage?.createdAt || new Date(u.createdAt || 0).getTime(),
        isSelf,
      };
    })
    .filter(({ user }) =>
      (user?.displayName || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const tA = new Date(a.updatedAt).getTime();
      const tB = new Date(b.updatedAt).getTime();
      return tB - tA;
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
        className="h-full border-r border-[#202C33] bg-[#0B141A] flex flex-col text-white"
      >
        {/* SEARCH */}
        <div className="px-3 py-2">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-full bg-[#202C33]
                       text-[#E9EDEF] placeholder:text-[#8696A0]
                       border-none focus-visible:ring-0"
          />
        </div>

        {/* SIDEBAR LIST */}
        <div className="flex-1 overflow-y-auto">
          {sidebarItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#8696A0] text-sm">
              No chats found
            </div>
          ) : (
            sidebarItems.map(({ user, lastMessage }) => (
              <div
                key={user._id}
                onClick={() => {
                  if (!currentUser) {
                    onRequireAuth?.();
                    return;
                  }
                  if (user._id === currentUserId) {
                    onSelectUser({ ...user, isSelf: true });
                  } else {
                    onSelectUser(user);
                  }
                }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer
                           hover:bg-[#202C33]"
              >
                <div className="relative">
                  <img
                    src={
                      user.avatar?.trim() ? user.avatar : "/default-avatar.jpeg"
                    }
                    alt={user.displayName || "User"}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/default-avatar.jpeg";
                    }}
                  />
                  {user.isActive && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-[#0B141A]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {user.displayName || "Unknown User"}
                    </span>
                    {!user.isActive && user.lastSeen && (
                      <span className="text-xs text-[#8696A0] whitespace-nowrap">
                        {formatLastSeen(user.lastSeen)}
                      </span>
                    )}
                  </div>

                  {lastMessage ? (
                    <div className="text-xs text-[#8696A0] truncate">
                      {lastMessage.content || (lastMessage.file ? `[${lastMessage.type || 'Attachment'}]` : '')}
                    </div>
                  ) : (
                    <div className="text-xs text-[#8696A0]">
                      {user.isActive
                        ? "active now"
                        : formatLastSeen(user.lastSeen)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-[#202C33] px-4 py-3">
          {!currentUser ? (
            <button
              onClick={onRequireAuth}
              className="w-full text-left text-sm py-2 px-3 rounded hover:bg-[#202C33] text-gray-200 transition cursor-pointer"
            >
              👤 Login to Chirp
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full text-left cursor-pointer hover:bg-[#202C33] p-1.5 rounded transition">
                  <img
                    src={currentUser.avatar || "/default-avatar.jpeg"}
                    alt={currentUser.displayName || "Avatar"}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/default-avatar.jpeg";
                    }}
                  />
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {currentUser.displayName}
                    </div>
                    <div className="text-xs text-[#8696A0] truncate">
                      @{currentUser.userName || "user"}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditProfile} className="cursor-pointer">
                  ✎ Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="text-red-500 cursor-pointer">
                  ⊗ Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      <div
        onMouseDown={() => (resizing.current = true)}
        className="w-[4px] cursor-col-resize bg-black hover:bg-[#00A884] transition-colors"
      />
    </>
  );
}
