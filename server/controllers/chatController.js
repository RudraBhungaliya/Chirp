import Chat from "../models/Chat.js";

// create chat
export const createChat = async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.userId;

    if (!userId) return res.status(400).json({ msg: "UserId is required" });

    let chat;

    // Handle self-chat (messaging yourself)
    if (myId === userId) {
      // For self-chat, find existing self-chat or create new one
      chat = await Chat.findOne({
        participants: { $size: 1, $in: [myId] },
      }).populate("participants", "userName displayName avatar isActive lastSeen");

      if (chat) return res.status(200).json(chat);

      // Create new self-chat with single participant
      chat = await Chat.create({
        participants: [myId],
      });
    } else {
      // For regular chats, find chat with both users
      chat = await Chat.findOne({
        participants: { $all: [myId, userId] },
      }).populate("participants", "userName displayName avatar isActive lastSeen");

      if (chat) return res.status(200).json(chat);

      // Create new chat
      chat = await Chat.create({
        participants: [myId, userId],
      });
    }

    chat = await chat.populate("participants", "userName displayName avatar isActive lastSeen");

    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getChats = async (req, res) => {
    try{
        const chats = await Chat.find( {
            participants : req.userId,
        } )
        .populate("participants", "userName displayName avatar isActive lastSeen")
        .populate("lastMessage")
        .sort( { updatedAt : -1 } );

        res.status(200).json(chats);
    }
    catch(err){
        res.status(500).json( { msg : err.message } );
    }
};
