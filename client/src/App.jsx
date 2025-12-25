import { useState, useEffect } from "react";

// components
import ChatList from "./components/chat/ChatList";
import ChatWindow from "./components/chat/ChatWindow";
import Auth from "./components/auth/Auth";

export default function App() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) setUser(storedUser);
  }, []);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setSelectedChat(null);
      return;
    }

    fetch("http://localhost:5000/api/chats", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then(setChats)
      .catch(console.error);
  }, [user]);

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
        <Auth
          onAuthSuccess={(u) => {
            setUser(u);
            setShowAuth(false);
          }}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}
