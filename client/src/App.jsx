import { useState, useEffect } from "react";

// components
import { useAuth } from "./context/authContext";
import { useSocket } from "./context/socketContext";
import GoogleLoginButton from "./components/auth/GoogleLoginButton";
import ProfileSetup from "./components/auth/ProfileSetup";
import ChatList from "./components/chat/ChatList";
import ChatWindow from "./components/chat/ChatWindow";

export default function App() {
  const API_URL = import.meta.env.VITE_API_URL || "";
  const { user, token, loading, logout } = useAuth();
  const { socket, disconnect } = useSocket();

  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // Fetch users as soon as token is available
  useEffect(() => {
    if (!token) {
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, [token, API_URL]);

  // Fetch chats as soon as token and user are available
  useEffect(() => {
    if (!user || !token) {
      setChats([]);
      setSelectedChat(null);
      return;
    }

    const fetchChats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/chats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChats(list);

        // Auto-select first chat if available and none selected
        if (list.length > 0 && !selectedChat) {
          setSelectedChat(list[0]);
        }
      } catch (err) {
        console.error("Error fetching chats:", err);
      }
    };

    fetchChats();
  }, [user, token, API_URL]);

  // Real-time socket event listeners for presence and messaging
  useEffect(() => {
    if (!socket || !token) return;

    const handleOnlineUsers = (onlineIds) => {
      const idSet = new Set((onlineIds || []).map(String));
      setUsers((prevUsers) =>
        prevUsers.map((u) => ({
          ...u,
          isActive: idSet.has(String(u._id)),
        }))
      );

      setChats((prevChats) =>
        prevChats.map((c) => ({
          ...c,
          participants: c.participants?.map((p) => ({
            ...p,
            isActive: idSet.has(String(p._id)),
          })),
        }))
      );

      setSelectedChat((prev) => {
        if (!prev || !prev.participants) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) => ({
            ...p,
            isActive: idSet.has(String(p._id)),
          })),
        };
      });
    };

    const handlePresenceUpdate = ({ userId, isActive, lastSeen }) => {
      const uId = String(userId);
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          String(u._id) === uId ? { ...u, isActive, lastSeen } : u
        )
      );

      setChats((prevChats) =>
        prevChats.map((c) => ({
          ...c,
          participants: c.participants?.map((p) =>
            String(p._id) === uId ? { ...p, isActive, lastSeen } : p
          ),
        }))
      );

      setSelectedChat((prev) => {
        if (!prev || !prev.participants) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            String(p._id || p) === uId ? { ...(typeof p === "object" ? p : { _id: p }), isActive, lastSeen } : p
          ),
        };
      });
    };

    const handleNewMessage = (m) => {
      setChats((prevChats) => {
        const idx = prevChats.findIndex((c) => c._id === m.chatId);

        if (idx !== -1) {
          const updatedChat = {
            ...prevChats[idx],
            lastMessage: m,
            updatedAt: m.createdAt,
          };

          const rest = prevChats.filter((_, i) => i !== idx);
          return [updatedChat, ...rest];
        }

        return [
          {
            _id: m.chatId,
            participants: m.participants,
            lastMessage: m,
            updatedAt: m.createdAt,
          },
          ...prevChats,
        ];
      });
    };

    const handleNewChat = (chat) => {
      setChats((prev) => {
        if (prev.some((c) => c._id === chat._id)) return prev;
        return [chat, ...prev];
      });
    };

    socket.on("online_users", handleOnlineUsers);
    socket.on("presence_update", handlePresenceUpdate);
    socket.on("new_message", handleNewMessage);
    socket.on("new_chat", handleNewChat);

    return () => {
      socket.off("online_users", handleOnlineUsers);
      socket.off("presence_update", handlePresenceUpdate);
      socket.off("new_message", handleNewMessage);
      socket.off("new_chat", handleNewChat);
    };
  }, [socket, token]);

  const handleProfileUpdate = () => {
    setShowProfileEdit(false);
  };

  // Instant conversation opener
  const handleSelectUser = async (selectedUser) => {
    if (!token || !user) {
      setShowAuth(true);
      return;
    }

    // Check if chat already exists locally for instant opening
    const existing = chats.find((c) => {
      const ids = c.participants?.map((p) => (typeof p === "string" ? p : p?._id)) || [];
      if (selectedUser._id === user._id) {
        return ids.length === 1 && ids[0] === user._id;
      }
      return ids.length === 2 && ids.includes(user._id) && ids.includes(selectedUser._id);
    });

    if (existing) {
      setSelectedChat(existing);
      return;
    }

    // Create temporary optimistic chat for 0ms response
    const tempId = `temp_${Date.now()}`;
    const optimisticChat = {
      _id: tempId,
      participants: selectedUser._id === user._id ? [user] : [user, selectedUser],
      lastMessage: null,
    };

    setSelectedChat(optimisticChat);
    setChats((prev) => [optimisticChat, ...prev]);

    try {
      const res = await fetch(`${API_URL}/api/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: selectedUser._id }),
      });

      if (res.ok) {
        const realChat = await res.json();
        setSelectedChat(realChat);
        setChats((prev) =>
          prev.map((c) => (c._id === tempId ? realChat : c))
        );
      }
    } catch (error) {
      console.error("Error selecting user:", error);
    }
  };

  const handleLogout = () => {
    if (user?._id) {
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u._id === user._id ? { ...u, isActive: false, lastSeen: new Date() } : u
        )
      );
    }

    logout();
    disconnect();
    setSelectedChat(null);
    setChats([]);
    setUsers([]);
    setShowAuth(false);
  };

  if (loading) return null;

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-[#0B141A] text-white"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* SIDEBAR */}
      <ChatList
        users={users}
        chats={chats}
        selectedChatId={selectedChat?._id}
        onSelectChat={setSelectedChat}
        onSelectUser={handleSelectUser}
        currentUser={user}
        onRequireAuth={() => setShowAuth(true)}
        onEditProfile={() => setShowProfileEdit(true)}
        onLogout={handleLogout}
      />

      {/* MESSAGING WORKSPACE */}
      <ChatWindow
        chat={selectedChat}
        user={user}
        users={users}
        onRequireAuth={() => setShowAuth(true)}
      />

      {/* AUTH POPUP MODAL */}
      {!user && showAuth && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAuth(false)}
        >
          <div
            className="bg-[#111B21] border border-[#222D34] p-6 rounded-lg max-w-xs w-full shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <GoogleLoginButton onLoginSuccess={() => setShowAuth(false)} />
            <button
              className="mt-4 text-xs text-[#8696A0] hover:text-white py-1 transition cursor-pointer"
              onClick={() => setShowAuth(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {user && showProfileEdit && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileEdit(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <ProfileSetup
              isModal={true}
              onClose={() => setShowProfileEdit(false)}
              onProfileUpdate={handleProfileUpdate}
            />
          </div>
        </div>
      )}
    </div>
  );
}
