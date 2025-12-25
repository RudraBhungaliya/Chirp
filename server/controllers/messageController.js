import Message from "../models/Message.js";
import Chat from "../models/Chat.js";

// get messages
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });

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
      return res.status(400).json({ msg: "No Messaege" });
    }

    const message = await Message.create({
      chatId,
      sender: req.userId,
      content,
      type,
      file,
    });

    // update chat preview
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
