import Chat from "../models/Chat.js";

// create chat
export const createChat = async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.userId;

    if (!userId) return res.status(400).json({ msg: "UserId is required" });

    // if exist
    let chat = await Chat.findOne({
      participants: { $all: [myId, userId] },
    }).populate("participants", "userName displayName avatar");

    if (chat) return res.status(200).json(chat);

    // create new chat
    chat = await Chat.create({
      participants: [myId, userId],
    });

    chat = await chat.populate("participants", "userName displayName avatar");

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
        .populate("participants", "userName displayName avatar")
        .populate("lastMessage")
        .sort( { updatedAt : -1 } );

        res.status(200).json(chats);
    }
    catch(err){
        res.status(500).json( { msg : err.message } );
    }


};
