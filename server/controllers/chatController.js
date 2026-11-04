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

// Retrieve user's conversation directory sorted by recent activity (high-performance single aggregation)
export const getChats = async (req, res) => {
  try {
    const userIdObj = new mongoose.Types.ObjectId(req.userId);

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

    if (!chats.length) {
      return res.status(200).json([]);
    }

    const chatIds = chats.map((c) => c._id);

    // Single high-speed aggregation query replacing N+1 sequential count queries
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          chatId: { $in: chatIds },
          sender: { $ne: userIdObj },
          readBy: { $ne: userIdObj },
        },
      },
      {
        $group: {
          _id: "$chatId",
          unreadCount: { $sum: 1 },
        },
      },
    ]);

    const unreadMap = new Map(
      unreadAgg.map((u) => [String(u._id), u.unreadCount])
    );

    const enhancedChats = chats.map((chat) => ({
      ...chat,
      unreadCount: unreadMap.get(String(chat._id)) || 0,
    }));

    res.status(200).json(enhancedChats);
  } catch (err) {
    console.error("getChats error:", err);
    res.status(500).json({ msg: err.message });
  }
};
