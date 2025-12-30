import { io } from "socket.io";

const VITE_SOCKET_URL = import.meta.env.SOCKET_URL;

export const connectSocket = (token) =>
  io(VITE_SOCKET_URL, {
    auth: { token },
    transports : ["websocket"],
  });
