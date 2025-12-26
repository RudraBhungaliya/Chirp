import { useState, useEffect } from "react";

// components
import { useAuth } from "./context/authContext";
import GoogleLoginButton from "./components/auth/GoogleLoginButton";
import ProfileSetup from "./components/auth/ProfileSetup";
import ChatList from "./components/chat/ChatList";
import ChatWindow from "./components/chat/ChatWindow";

export default function App() {
  const { user, token, loading, needsProfile } = useAuth();

  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setSelectedChat(null);
      return;
    }

    fetch("http://localhost:5000/api/chats", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then(setChats)
      .catch(console.error);
  }, [user, token]);

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
    </div>
  );
}
