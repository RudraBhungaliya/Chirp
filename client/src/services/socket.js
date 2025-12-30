import { io } from "socket.io-client";

const VITE_SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export const connectSocket = (token) =>
  io(VITE_SOCKET_URL, {
    auth: { token },
    transports : ["websocket"],
  });
