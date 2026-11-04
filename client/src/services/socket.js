import { io } from "socket.io-client";

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return window.location.origin;
  }
  return "http://localhost:5001";
};

export const connectSocket = (token) => {
  const socket = io(getSocketUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    timeout: 10000,
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket Notice] connect_error:", err.message);
  });

  return socket;
};
