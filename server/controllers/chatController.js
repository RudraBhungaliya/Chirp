import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import { io } from "../server.js";
import mongoose from "mongoose";

// Create or retrieve existing direct or self chat
export const createChat = async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Valid userId is required" });
    }

    let chat;

    // Handle self-chat (notes / messaging yourself)
    if (myId === userId) {
      chat = await Chat.findOne({
        participants: { $size: 1, $in: [myId] },
      })
        .populate("participants", "userName displayName avatar isActive lastSeen")
        .populate("lastMessage");

      if (chat) return res.status(200).json(chat);

      chat = await Chat.create({
        participants: [myId],
      });
    } else {
      // Find direct conversation between both users
      chat = await Chat.findOne({
        participants: { $all: [myId, userId], $size: 2 },
      })
        .populate("participants", "userName displayName avatar isActive lastSeen")
        .populate("lastMessage");

      if (chat) return res.status(200).json(chat);

      chat = await Chat.create({
        participants: [myId, userId],
      });
    }

    chat = await chat.populate("participants", "userName displayName avatar isActive lastSeen");

    // Real-time broadcast to participant rooms
    if (io) {
      chat.participants.forEach((p) => {
        io.to(`user:${p._id.toString()}`).emit("new_chat", chat);
      });
    }

    res.status(201).json(chat);
  } catch (err) {
    console.error("createChat error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Retrieve user's conversation directory sorted by recent activity
export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.userId,
    })
      .populate("participants", "userName displayName avatar isActive lastSeen")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "displayName userName avatar _id",
        },
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Attach real-time unread counts per chat
    const enhancedChats = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chatId: chat._id,
          sender: { $ne: req.userId },
          readBy: { $ne: req.userId },
        });

        return {
          ...chat,
          unreadCount,
        };
      })
    );

    res.status(200).json(enhancedChats);
  } catch (err) {
    console.error("getChats error:", err);
    res.status(500).json({ msg: err.message });
  }
};
