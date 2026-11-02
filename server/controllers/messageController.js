import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import { io } from "../server.js";
import { emitNewMessage } from "../utils/emitter.js";
import mongoose from "mongoose";

// Fetch messages with pagination support (sub-10ms query with compound index)
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before; // ISO timestamp or message ID for cursor pagination

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ msg: "Invalid chat ID" });
    }

    // Verify user is part of this chat
    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ msg: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === req.userId
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ msg: "Not authorized to view these messages" });
    }

    const query = { chatId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Fetch messages in reverse chronological order for index efficiency
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("sender", "displayName userName avatar _id")
      .lean();

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // Return chronological order for UI consumption
    resultMessages.reverse();

    // Mark messages as read by current user asynchronously
    Message.updateMany(
      {
        chatId,
        sender: { $ne: req.userId },
        readBy: { $ne: req.userId },
      },
      {
        $addToSet: { readBy: req.userId },
        $set: { status: "read" },
      }
    ).exec().catch(() => {});

    res.json({
      messages: resultMessages,
      hasMore,
    });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Send standard text message
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content = "", clientId = null } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ msg: "Invalid chat ID" });
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return res.status(400).json({ msg: "Message content cannot be empty" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ msg: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === req.userId
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ msg: "Not authorized to send messages in this chat" });
    }

    if (clientId) {
      const existing = await Message.findOne({ chatId, clientId });
      if (existing) {
        await existing.populate("sender", "displayName userName avatar _id");
        return res.status(200).json(existing);
      }
    }

    const message = await Message.create({
      chatId,
      sender: req.userId,
      type: "text",
      content: trimmed,
      clientId,
      readBy: [req.userId],
      status: "sent",
    });

    await message.populate("sender", "displayName userName avatar _id");

    // Update conversation preview and timestamp
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    // Broadcast in real-time
    emitNewMessage(io, chatId, message);

    res.status(201).json(message);
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Send media file message
export const sendFileMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { type = "document", clientId = null } = req.body;
    const file = req.file;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ msg: "Invalid chat ID" });
    }

    if (!file) {
      return res.status(400).json({ msg: "No file provided" });
    }

    if (!["image", "video", "audio", "document"].includes(type)) {
      return res.status(400).json({ msg: "Invalid file type specification" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ msg: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === req.userId
    );
    if (!isParticipant) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    if (clientId) {
      const existing = await Message.findOne({ chatId, clientId });
      if (existing) {
        await existing.populate("sender", "displayName userName avatar _id");
        return res.status(200).json(existing);
      }
    }

    let fileUrl = null;

    if (file.buffer) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "uploads",
      });

      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
        metadata: {
          uploadedBy: req.userId,
          chatId,
          size: file.size,
        },
      });

      uploadStream.end(file.buffer);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });

      fileUrl = `/api/message/file/${uploadStream.id}`;
    } else {
      fileUrl = `/uploads/${file.filename}`;
    }

    const message = await Message.create({
      chatId,
      sender: req.userId,
      type,
      file: {
        name: file.originalname,
        mime: file.mimetype,
        url: fileUrl,
        size: file.size,
        expiresAt:
          type === "video" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      },
      clientId,
      readBy: [req.userId],
      status: "sent",
    });

    await message.populate("sender", "displayName userName avatar _id");

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    emitNewMessage(io, chatId, message);

    res.status(201).json(message);
  } catch (err) {
    console.error("sendFileMessage error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Mark conversation messages as read
export const markChatAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ msg: "Invalid chat ID" });
    }

    await Message.updateMany(
      {
        chatId,
        sender: { $ne: req.userId },
        readBy: { $ne: req.userId },
      },
      {
        $addToSet: { readBy: req.userId },
        $set: { status: "read" },
      }
    );

    // Notify other room participants
    if (io) {
      io.to(chatId).emit("messages_read", {
        chatId,
        readerId: req.userId,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Soft delete message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ msg: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ msg: "Message not found" });
    }

    if (message.sender.toString() !== req.userId) {
      return res
        .status(403)
        .json({ msg: "Not authorized to delete this message" });
    }

    message.deleted = true;
    message.content = "This message was deleted";
    message.file = null;
    await message.save();

    await message.populate("sender", "displayName userName avatar _id");

    if (io) {
      io.to(message.chatId.toString()).emit("message_deleted", {
        chatId: message.chatId,
        messageId: message._id,
      });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Low-latency media streaming from GridFS with HTTP Range requests & aggressive caching
export const getFile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid file identifier" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const _id = new mongoose.Types.ObjectId(id);
    const files = await bucket.find({ _id }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ msg: "File not found" });
    }

    const fileDoc = files[0];
    const totalLength = fileDoc.length;
    const contentType = fileDoc.contentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Handle HTTP Range request for audio/video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

      if (start >= totalLength || end >= totalLength) {
        res.setHeader("Content-Range", `bytes */${totalLength}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalLength}`);
      res.setHeader("Content-Length", chunkSize);

      const downloadStream = bucket.openDownloadStream(_id, {
        start,
        end: end + 1,
      });
      downloadStream.on("error", () => res.status(500).end());
      downloadStream.pipe(res);
    } else {
      res.setHeader("Content-Length", totalLength);
      const downloadStream = bucket.openDownloadStream(_id);
      downloadStream.on("error", () => res.status(500).end());
      downloadStream.pipe(res);
    }
  } catch (err) {
    console.error("getFile streaming error:", err);
    res.status(500).json({ msg: err.message });
  }
};
