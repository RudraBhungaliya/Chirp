import { io } from "socket.io-client";

const VITE_SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5001";

export const connectSocket = (token) => {
  const socket = io(VITE_SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connect_error:", err.message);
  });

  return socket;
};
