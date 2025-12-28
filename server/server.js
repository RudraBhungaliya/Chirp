import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

import authRoute from "./routes/authRoute.js";
import chatRoute from "./routes/chatRoute.js";
import messageRoute from "./routes/messageRoute.js";
import userRoute from "./routes/userRoute.js";

import Chat from "./models/Chat.js";
import Message from "./models/Message.js";
import User from "./models/User.js";
import { searchUsers } from "./controllers/userController.js";

// ENV
dotenv.config();

// DB
connectDB();

// app
const app = express();
const server = http.createServer(app);

// middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoute);
app.use("/api/chats", chatRoute);
app.use("/api/message", messageRoute);
app.use("/api/users", userRoute);

// socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// socket auth (jwt)
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
});

// socket connection
io.on("connection", async (socket) => {
  try {
    // mark user online
    await User.findByIdAndUpdate(socket.userId, {
      isActive: true,
      lastSeen: new Date(),
    });

    console.log("User connected:", socket.userId);

    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
    });

    socket.on("send_message", async ({ chatId, content, type = "text" }) => {
      if (!chatId || !content) return;

      const message = await Message.create({
        chatId,
        sender: socket.userId,
        content,
        type,
      });

      await message.populate("sender", "displayName avatar _id");

      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: message._id,
      });

      io.to(chatId).emit("new_message", message);
    });

    socket.on("disconnect", async () => {
      await User.findByIdAndUpdate(socket.userId, {
        isActive: false,
        lastSeen: new Date(),
      });

      console.log("User disconnected:", socket.userId);
    });
  } catch (err) {
    console.error("Socket error:", err.message);
  }
});

// server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port : ${PORT}`);
});
