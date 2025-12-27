import { useState, useEffect } from "react";

// components
import { useAuth } from "./context/authContext";
import GoogleLoginButton from "./components/auth/GoogleLoginButton";
import ProfileSetup from "./components/auth/ProfileSetup";
import ChatList from "./components/chat/ChatList";
import ChatWindow from "./components/chat/ChatWindow";

export default function App() {
  const { user, token, loading, needsProfile, login, logout } = useAuth();

  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setChats([]);
      setSelectedChat(null);
      return;
    }

    // Create or get self-chat for the user
    const initializeChats = async () => {
      try {
        // First, create self-chat
        await fetch(
          `${import.meta.env.VITE_API_URL}/api/chats/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              userId: user._id,
            }),
          }
        );
      } catch (error) {
        console.error("Error creating self-chat:", error);
      }

      try {
        // Then fetch all chats
        const chatsRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/chats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const allChats = await chatsRes.json();
        setChats(allChats);
      } catch (error) {
        console.error("Error fetching chats:", error);
      }
    };

    initializeChats();
  }, [user, token]);

  const handleProfileUpdate = (updatedUser) => {
    login({
      token,
      user: updatedUser,
    });
    setShowProfileEdit(false);
  };

  const handleLogout = () => {
    logout();
    setSelectedChat(null);
    setChats([]);
    setShowAuth(false);
  };

  if (loading) return null;

  if (user && needsProfile) {
    return <ProfileSetup />;
  }

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-background text-textPrimary"
      onContextMenu={(e) => e.preventDefault()}
    >
      <ChatList
        chats={chats}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        currentUserId={user?._id}
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
        <ProfileSetup
          isModal={true}
          onClose={() => setShowProfileEdit(false)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
}
