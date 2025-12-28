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
  const [users, setUsers] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showInitialProfileSetup, setShowInitialProfileSetup] = useState(needsProfile);

  // Only initialize chats after profile is complete
  useEffect(() => {
    if (!user || !token || needsProfile) {
      setChats([]);
      setUsers([]);
      setSelectedChat(null);
      return;
    }

    const initializeChatsAndUsers = async () => {
      try {
        // Fetch all users
        const usersRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/users`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const allUsers = await usersRes.json();
        setUsers(allUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      }

      try {
        // Fetch all chats
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

    initializeChatsAndUsers();
  }, [user, token, needsProfile]);

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
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/chats`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: selectedUser._id,
          }),
        }
      );

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
    logout();
    setSelectedChat(null);
    setChats([]);
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
        chats={chats}
        users={users}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        onSelectUser={handleSelectUser}
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
