import Message from "../models/Message.js";
import Chat from "../models/Chat.js";

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
      return res.status(403).json({ msg: "Not authorized to view these messages" });
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
    const { content = "", type = "text", file = null } = req.body;

    if (!content && !file) {
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
      return res.status(403).json({ msg: "Not authorized to send messages in this chat" });
    }

    const message = await Message.create({
      chatId,
      sender: req.userId,
      content,
      type,
      file,
    });

    // Populate sender info
    await message.populate("sender", "displayName avatar _id");

    // update chat preview with populated message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
    }).populate("lastMessage");

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
      return res.status(403).json({ msg: "Not authorized to delete this message" });
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
