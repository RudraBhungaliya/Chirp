import { io } from "socket.io-client";

export const connectSocket = (token) =>
  io("http://localhost:5000", {
    auth: { token },
  });
