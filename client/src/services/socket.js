import { io } from "socket.io-client";

const VITE_SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

if (!VITE_SOCKET_URL) {
  console.warn("VITE_SOCKET_URL is not set. Socket will try to connect to current origin.");
}

export const connectSocket = (token) => {
  const url = VITE_SOCKET_URL || undefined; // undefined => uses current origin
  const socket = io(url, {
    auth: { token },
    transports: ["websocket"],
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connect_error:", err);
  });

  return socket;
};
