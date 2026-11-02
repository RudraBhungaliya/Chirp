import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import mongoose from "mongoose";

import connectDB, { isDbConnected, disconnectDB } from "./config/db.js";

import authRoute from "./routes/authRoute.js";
import chatRoute from "./routes/chatRoute.js";
import messageRoute from "./routes/messageRoute.js";
import userRoute from "./routes/userRoute.js";

import Chat from "./models/Chat.js";
import Message from "./models/Message.js";
import User from "./models/User.js";
import { emitNewMessage } from "./utils/emitter.js";

// Initialize persistent database connection pool
connectDB();

mongoose.connection.once("open", async () => {
  try {
    await User.updateMany({}, { isActive: false });
    console.log("[Chirp Server] Presence initialized: all users marked offline on startup.");
  } catch (e) {
    console.error("Failed to reset presence on startup:", e.message);
  }
});

const app = express();
const server = http.createServer(app);

// Environment Configurations
const PORT = parseInt(process.env.PORT, 10) || 5001;
const JWT_SECRET = process.env.JWT_SECRET || "chirp_jwt_secret_dev_key_2026";
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://localhost:5001",
    ];

// Security & Performance Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());

// Industry-grade CORS policy
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation"));
    },
    credentials: true,
  })
);

// Rate limiting for production stability
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many requests, please try again later." },
});
app.use("/api", globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many auth attempts. Please wait a few minutes." },
});
app.use("/api/auth", authLimiter);

// Payload parsers
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use("/uploads", express.static("uploads"));

// Health & Readiness checks
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Chirp API",
    dbConnected: isDbConnected(),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    port: PORT,
  });
});

// Safeguard middleware: Prevents hanging if DB connection pool is not ready
app.use((req, res, next) => {
  if (req.path.startsWith("/api") && !isDbConnected()) {
    return res.status(503).json({
      msg: "Database connection not ready. Please verify MONGO_URI in server/.env.",
    });
  }
  next();
});

// Application Routes
app.use("/api/auth", authRoute);
app.use("/api/chats", chatRoute);
app.use("/api/message", messageRoute);
app.use("/api/users", userRoute);

// High-performance Socket.IO configuration with heartbeat tuning
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation"));
    },
    credentials: true,
  },
  pingInterval: 10000, // 10s ping
  pingTimeout: 5000,   // 5s timeout for fast disconnect detection
  transports: ["websocket", "polling"],
});

// Socket JWT Authentication
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized: missing token"));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = String(decoded.userId);
    next();
  } catch (err) {
    next(new Error("Unauthorized: invalid token"));
  }
});

// Multi-device Presence Tracker (Maps userId -> Set of active socket IDs)
const userSockets = new Map();

export const isUserOnline = (userId) => {
  if (!userId) return false;
  return Boolean(userSockets.get(String(userId))?.size > 0);
};

export const getOnlineUserIds = () => {
  return Array.from(userSockets.keys()).filter(
    (id) => userSockets.get(id)?.size > 0
  );
};

io.on("connection", async (socket) => {
  const userId = socket.userId ? String(socket.userId) : null;
  if (!userId) return;

  try {
    // Register socket session
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    const currentSockets = userSockets.get(userId);
    const wasOffline = currentSockets.size === 0;
    currentSockets.add(socket.id);

    // Join dedicated user room for direct push notifications
    socket.join(`user:${userId}`);

    // If first connected device/tab, mark online in persistent store and broadcast
    if (wasOffline) {
      await User.findByIdAndUpdate(userId, { isActive: true });
      io.emit("presence_update", {
        userId,
        isActive: true,
        lastSeen: new Date(),
      });
    }

    // Send all currently active user IDs to this socket immediately
    const onlineIds = Array.from(userSockets.keys()).filter(
      (id) => userSockets.get(id)?.size > 0
    );
    socket.emit("online_users", onlineIds);

    // Room subscription
    socket.on("join_chat", (chatId) => {
      if (chatId) socket.join(chatId);
    });

    socket.on("leave_chat", (chatId) => {
      if (chatId) socket.leave(chatId);
    });

    // Real-time typing indicators
    socket.on("typing_start", ({ chatId, displayName }) => {
      if (!chatId) return;
      socket.to(chatId).emit("user_typing", {
        chatId,
        userId,
        displayName: displayName || "Someone",
      });
    });

    socket.on("typing_stop", ({ chatId }) => {
      if (!chatId) return;
      socket.to(chatId).emit("user_stopped_typing", {
        chatId,
        userId,
      });
    });

    // Real-time read receipt delivery
    socket.on("mark_read", async ({ chatId }) => {
      if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) return;
      await Message.updateMany(
        {
          chatId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        {
          $addToSet: { readBy: userId },
          $set: { status: "read" },
        }
      );
      socket.to(chatId).emit("messages_read", { chatId, readerId: userId });
    });

    // Real-time low-latency message transmission over WebSocket
    socket.on("send_message", async ({ chatId, content, type = "text", clientId }, ack) => {
      if (!chatId || !content || !content.trim()) return;

      try {
        if (clientId) {
          const existing = await Message.findOne({ chatId, clientId });
          if (existing) {
            await existing.populate("sender", "displayName userName avatar _id");
            if (typeof ack === "function") ack({ status: "ok", message: existing });
            return;
          }
        }

        const message = await Message.create({
          chatId,
          sender: userId,
          content: content.trim(),
          type,
          clientId: clientId || null,
          readBy: [userId],
          status: "sent",
        });

        await message.populate("sender", "displayName userName avatar _id");

        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        emitNewMessage(io, chatId, message);

        // Also notify participant individual rooms for instantaneous sidebar ordering
        const chatDoc = await Chat.findById(chatId).select("participants").lean();
        if (chatDoc) {
          chatDoc.participants.forEach((p) => {
            io.to(`user:${p.toString()}`).emit("chat_activity", {
              chatId,
              lastMessage: message,
            });
          });
        }

        if (typeof ack === "function") {
          ack({ status: "ok", message });
        }
      } catch (err) {
        console.error("Socket send_message error:", err);
        if (typeof ack === "function") ack({ status: "error", error: err.message });
      }
    });

    // Disconnect handler with multi-tab awareness
    socket.on("disconnect", async () => {
      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(userId);
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, {
            isActive: false,
            lastSeen,
          });

          io.emit("presence_update", {
            userId,
            isActive: false,
            lastSeen,
          });
        }
      }
    });
  } catch (err) {
    console.error("Socket error on connection:", err);
  }
});

export { io };

// Server startup
server.listen(PORT, () => {
  console.log(`[Chirp Server] Live and listening on port: ${PORT}`);
  console.log(`[Chirp Server] CORS Allowed Origins: ${allowedOrigins.join(", ")}`);
});

// Clean graceful shutdown on process termination
const handleGracefulShutdown = async (signal) => {
  console.log(`\n[Chirp Server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await disconnectDB();
    console.log("[Chirp Server] Closed all pending connections. Goodbye.");
    process.exit(0);
  });
};

process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
