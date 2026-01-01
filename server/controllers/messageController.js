import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import { io } from "../server.js";
import { emitNewMessage } from "../utils/emitter.js";
import mongoose from "mongoose";

// get messages
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify user is part of this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ msg: "Chat not found" });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      (p) => p.toString() === req.userId
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ msg: "Not authorized to view these messages" });
    }

    const messages = await Message.find({ chatId })
      .populate("sender", "displayName avatar _id")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// send message
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content = "", clientId = null } = req.body;

    if (!content.trim()) {
      return res.status(400).json({ msg: "No Message" });
    }

    // Verify user is part of this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ msg: "Chat not found" });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      (p) => p.toString() === req.userId
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ msg: "Not authorized to send messages in this chat" });
    }

    const message = await Message.create({
      chatId,
      sender: req.userId,
      type: "text",
      content,
      clientId,
    });

    // Populate sender info
    await message.populate("sender", "displayName avatar _id");

    // update chat preview with populated message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
    }).populate("lastMessage");

    emitNewMessage(io, chatId, message);
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// send file message
export const sendFileMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { type } = req.body;
    const file = req.file;
    const clientId = req.body?.clientId || null;

    if (!file) {
      return res.status(400).json({ msg: "No File Uploaded" });
    }

    if (!["image", "video", "audio", "document"].includes(type)) {
      return res.status(400).json({ msg: "Invalid file type" });
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

    // If multer stored file in memory (buffer), persist to GridFS for permanence
    let fileUrl = null;

    if (file.buffer) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "uploads",
      });

      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
      });

      uploadStream.end(file.buffer);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });

      const fileId = uploadStream.id;
      fileUrl = `/api/message/file/${fileId}`;
    } else {
      // fallback to disk-based uploads
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
        expiresAt:
          type === "video" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      },
      clientId,
    });

    await message.populate("sender", "displayName avatar _id");

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
    });

    emitNewMessage(io, chatId, message);
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// delete message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ msg: "Message not found" });
    }

    // Only allow deletion by the message sender
    if (message.sender.toString() !== req.userId) {
      return res
        .status(403)
        .json({ msg: "Not authorized to delete this message" });
    }

    // Soft delete - just mark as deleted
    message.deleted = true;
    message.content = "";
    message.file = null;
    await message.save();

    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// serve file from GridFS
export const getFile = async (req, res) => {
  try {
    const { id } = req.params;

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const _id = new mongoose.Types.ObjectId(id);

    // get file metadata to set content-type
    const files = await bucket.find({ _id }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ msg: "File not found" });
    }

    const fileDoc = files[0];
    if (fileDoc.contentType) res.type(fileDoc.contentType);

    const downloadStream = bucket.openDownloadStream(_id);
    downloadStream.on("error", (err) => res.status(404).end());
    downloadStream.pipe(res);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
