import { useState } from "react";

// components
import ChatList from "./components/chat/ChatList";
import ChatWindow from "./components/chat/ChatWindow";

export default function App() {
  const [selectedChat, setSelectedChat] = useState(null);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background text-textPrimary">
      <ChatList selectedChat={selectedChat} onSelectChat={setSelectedChat} />

      <ChatWindow chat={selectedChat} />
    </div>
  );
}
