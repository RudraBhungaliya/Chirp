import { useState, useEffect, useRef } from "react";

// components
import { useAuth } from "./context/authContext";
import { useSocket } from "./context/socketContext";
import GoogleLoginButton from "./components/auth/GoogleLoginButton";
import ProfileSetup from "./components/auth/ProfileSetup";
import ChatList from "./components/chat/ChatList";
import ChatWindow from "./components/chat/ChatWindow";

export default function App() {
  console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
  const { user, token, loading, needsProfile, login, logout } = useAuth();
  const { socket, disconnect } = useSocket();

  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showInitialProfileSetup, setShowInitialProfileSetup] =
    useState(needsProfile);

  useEffect(() => {
    if (!token || !socket) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    // Listen for presence updates
    socket.on("presence_update", ({ userId, isActive, lastSeen }) => {
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u._id === userId ? { ...u, isActive, lastSeen } : u
        )
      );
    });

    fetchUsers();

    return () => {
      socket.off("presence_update");
    };
  }, [token, socket]);

  useEffect(() => {
    if (!user || !token || needsProfile) {
      setChats([]);
      setSelectedChat(null);
      return;
    }

    const fetchChats = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setChats(data);
      } catch (err) {
        console.error("Error fetching chats:", err);
      }
    };

    fetchChats();
  }, [user, token, needsProfile]);

  useEffect(() => {
    if (!socket || !user) return;

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

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket, user]);

  const handleProfileUpdate = (updatedUser) => {
    login({
      token,
      user: updatedUser,
    });
    setShowProfileEdit(false);
    setShowInitialProfileSetup(false);
  };

  const handleSelectUser = async (selectedUser) => {
    try {
      // Create or get chat with the selected user
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedUser._id,
        }),
      });

      if (!res.ok) {
        console.error("Failed to create/get chat");
        return;
      }

      const chat = await res.json();
      setSelectedChat(chat);

      // Add to chats list if not already there
      setChats((prevChats) => {
        const exists = prevChats.some((c) => c._id === chat._id);
        if (exists) {
          return prevChats;
        }
        return [chat, ...prevChats];
      });
    } catch (error) {
      console.error("Error selecting user:", error);
    }
  };

  const handleLogout = () => {
    // Mark current user as offline immediately
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u._id === user._id ? { ...u, isActive: false, lastSeen: new Date() } : u
      )
    );

    logout();
    disconnect();
    setSelectedChat(null);
    setChats([]);
    setUsers([]);
    setShowAuth(false);
  };

  if (loading) return null;

  if (user && showInitialProfileSetup) {
    return <ProfileSetup onProfileUpdate={handleProfileUpdate} />;
  }

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-background text-textPrimary"
      onContextMenu={(e) => e.preventDefault()}
    >
      <ChatList
        users={users}
        chats = {chats}
        onSelectChat={setSelectedChat}
        onSelectUser={handleSelectUser}
        currentUser={user}
        onRequireAuth={() => setShowAuth(true)}
        onEditProfile={() => setShowProfileEdit(true)}
        onLogout={handleLogout}
      />

      <ChatWindow
        chat={selectedChat}
        user={user}
        onRequireAuth={() => setShowAuth(true)}
      />

      {!user && showAuth && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#111B21] p-6 rounded">
            <GoogleLoginButton />
            <button
              className="mt-4 text-sm text-gray-400"
              onClick={() => setShowAuth(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {user && showProfileEdit && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowProfileEdit(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
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
