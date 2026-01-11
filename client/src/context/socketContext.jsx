import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useAuth } from "./authContext";
import { connectSocket } from "../services/socket";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Create socket connection if it doesn't exist
    if (!socketRef.current) {
      socketRef.current = connectSocket(token);

      socketRef.current.on("connect", () => {
        setIsConnected(true);
        console.log("Socket connected", { uri: socketRef.current?.io?.uri });
      });

      socketRef.current.on("disconnect", () => {
        setIsConnected(false);
        console.log("Socket disconnected");
      });

      socketRef.current.on("connect_error", (err) => {
        console.error("Socket connect_error:", err);
      });
    }

    return () => {
      // Don't disconnect on unmount, only when token changes
    };
  }, [token]);

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, disconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
};
