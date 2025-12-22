import { useState } from "react";
import ChatList from "./components/chat/ChatList";
import ChatWindow from "./components/chat/ChatWindow";

export default function App() {
  const [selectedChat, setSelectedChat] = useState(null);

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <ChatList selectedChat={selectedChat} onSelectChat={setSelectedChat} />

      <ChatWindow chat={selectedChat} />
    </div>
  );
}
