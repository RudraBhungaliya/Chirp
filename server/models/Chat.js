import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
    {
        participants : [
            {
                type : mongoose.Schema.Types.ObjectId,
                ref : "User",
                required : true,
            },
        ],

        lastMessage: {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Message",
        }


    },
    {
        timestamps : true
    }
);

export default  mongoose.model("Chat", chatSchema);