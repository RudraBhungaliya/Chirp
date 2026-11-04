import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Search,
  X,
  Check,
  CheckCheck,
  LogOut,
  Edit3,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DEFAULT_AVATAR = "/default-avatar.jpeg";

const getAvatar = (avatar) => {
  if (!avatar || typeof avatar !== "string" || avatar.trim() === "")
    return DEFAULT_AVATAR;
  return avatar;
};

// Relative presence timestamp format
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

// WhatsApp message timestamp format
const formatMessageTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
};

export default function ChatList({
  onSelectUser,
  onSelectChat,
  selectedChatId,
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

  const currentUserId = currentUser?._id ? String(currentUser._id) : null;

  // Build unified conversation list from all authenticated users
  const sidebarItems = (users || [])
    .map((u) => {
      const uId = String(u._id);
      const isSelf = Boolean(currentUserId && uId === currentUserId);

      const chat = (chats || []).find((c) => {
        if (!c || !c.participants) return false;
        const ids = c.participants.map((p) =>
          String(typeof p === "string" ? p : p?._id)
        );

        if (isSelf) {
          return ids.length === 1 && ids[0] === currentUserId;
        }

        return (
          Boolean(currentUserId) &&
          ids.length === 2 &&
          ids.includes(currentUserId) &&
          ids.includes(uId)
        );
      });

      const lastMsg = chat?.lastMessage || null;
      const updatedAt =
        lastMsg?.createdAt || chat?.updatedAt || u.createdAt || 0;

      return {
        user: u,
        chat: chat || null,
        lastMessage: lastMsg,
        updatedAt: new Date(updatedAt).getTime(),
        isSelf,
      };
    })
    .filter(({ user: itemUser, lastMessage }) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = (itemUser?.displayName || "").toLowerCase();
      const username = (itemUser?.userName || "").toLowerCase();
      const msg = (lastMessage?.content || "").toLowerCase();
      return name.includes(q) || username.includes(q) || msg.includes(q);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

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
        className="h-full border-r border-[#222D34] bg-[#111B21] flex flex-col text-[#E9EDEF] select-none shrink-0 relative overflow-hidden"
      >
        {/* TOP SEARCH BAR */}
        <div className="px-3 py-2 bg-[#111B21] border-b border-[#222D34]">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#8696A0] absolute left-3 pointer-events-none" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 pr-8 rounded-full bg-[#202C33] text-[#E9EDEF] placeholder:text-[#8696A0] border-none focus-visible:ring-0 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* MAIN USERS & CHATS LIST */}
        <div className="flex-1 overflow-y-auto">
          {sidebarItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#8696A0] text-sm">
              No chats found
            </div>
          ) : (
            sidebarItems.map(({ user: itemUser, chat, lastMessage, updatedAt, isSelf }) => {
              const isSelected =
                (chat && selectedChatId && String(chat._id) === String(selectedChatId)) ||
                (selectedChatId &&
                  selectedChatId.startsWith("temp_") &&
                  (isSelf
                    ? itemUser._id === currentUserId
                    : itemUser._id !== currentUserId));

              const isMyLastMsg =
                lastMessage &&
                (String(lastMessage.sender?._id || lastMessage.sender) === currentUserId);

              return (
                <div
                  key={itemUser._id}
                  onClick={() => {
                    if (!currentUser) {
                      onRequireAuth?.();
                      return;
                    }
                    if (chat) {
                      onSelectChat?.(chat);
                    } else {
                      onSelectUser?.(itemUser);
                    }
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 cursor-pointer border-b border-[#222D34]/40 transition-colors ${
                    isSelected ? "bg-[#2A3942]" : "hover:bg-[#202C33]"
                  }`}
                >
                  {/* AVATAR WITH ONLINE BADGE */}
                  <div className="relative shrink-0">
                    <img
                      src={getAvatar(itemUser.avatar)}
                      alt={itemUser.displayName || "Avatar"}
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 rounded-full object-cover bg-[#202C33]"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    {itemUser.isActive && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00A884] rounded-full border-2 border-[#111B21]" />
                    )}
                  </div>

                  {/* USER & MESSAGE DETAILS */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-normal text-[16px] text-[#E9EDEF] truncate">
                        {itemUser.displayName || "User"}
                        {isSelf && (
                          <span className="text-xs text-[#8696A0] ml-1.5 font-normal">
                            (You)
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-[12px] whitespace-nowrap shrink-0 ${
                          isSelected ? "text-[#E9EDEF]" : "text-[#8696A0]"
                        }`}
                      >
                        {lastMessage
                          ? formatMessageTime(updatedAt)
                          : itemUser.isActive
                          ? ""
                          : formatLastSeen(itemUser.lastSeen)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13px] text-[#8696A0] truncate flex items-center gap-1">
                        {lastMessage ? (
                          <>
                            {isMyLastMsg && !lastMessage.deleted && (
                              <span className="inline-flex shrink-0">
                                {lastMessage.status === "read" ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                                ) : lastMessage.status === "delivered" ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#8696A0]" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-[#8696A0]" />
                                )}
                              </span>
                            )}
                            <span className="truncate">
                              {lastMessage.deleted ? (
                                <i className="text-[#8696A0]/80">This message was deleted</i>
                              ) : lastMessage.content ? (
                                lastMessage.content
                              ) : lastMessage.file ? (
                                `📎 ${lastMessage.type || "Attachment"}`
                              ) : (
                                "Message"
                              )}
                            </span>
                          </>
                        ) : (
                          <span
                            className={
                              itemUser.isActive
                                ? "text-[#00A884] font-medium"
                                : "text-[#8696A0]"
                            }
                          >
                            {itemUser.isActive
                              ? "active now"
                              : itemUser.lastSeen
                              ? formatLastSeen(itemUser.lastSeen)
                              : "offline"}
                          </span>
                        )}
                      </div>

                      {chat?.unreadCount > 0 && !isSelected && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#00A884] text-[#111B21] text-[11px] font-bold flex items-center justify-center shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ORIGINAL FOOTER: USER PROFILE / LOGIN TO CHIRP */}
        <div className="border-t border-[#202C33] px-4 py-3 bg-[#111B21] shrink-0">
          {!currentUser ? (
            <button
              onClick={onRequireAuth}
              className="w-full text-left text-sm py-2 px-3 rounded hover:bg-[#202C33] text-gray-200 transition cursor-pointer flex items-center gap-2.5"
            >
              <span>👤</span>
              <span className="font-medium">Login to Chirp</span>
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full text-left cursor-pointer hover:bg-[#202C33] p-1.5 rounded transition">
                  <div className="relative shrink-0">
                    <img
                      src={getAvatar(currentUser.avatar)}
                      alt={currentUser.displayName || "Avatar"}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover shrink-0 bg-[#202C33]"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00A884] rounded-full border-2 border-[#111B21]" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#E9EDEF] truncate">
                      {currentUser.displayName}
                    </div>
                    <div className="text-xs text-[#8696A0] truncate">
                      @{currentUser.userName || "user"}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-[#233138] border border-[#233138] text-[#D1D7DB] shadow-2xl rounded p-1 min-w-[160px]"
              >
                <DropdownMenuItem
                  onClick={onEditProfile}
                  className="cursor-pointer hover:bg-[#182229] px-3 py-2 text-sm text-[#E9EDEF] flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4 text-[#AEBAC1]" />
                  ✎ Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer hover:bg-[#182229] px-3 py-2 text-sm text-red-400 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  ⊗ Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* DRAGGABLE RESIZER BAR */}
      <div
        onMouseDown={() => (resizing.current = true)}
        className="w-[3px] cursor-col-resize bg-[#202C33] hover:bg-[#00A884] transition-colors"
      />
    </>
  );
}
