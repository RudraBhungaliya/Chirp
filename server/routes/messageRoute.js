import express from "express";
import auth from "../middleware/auth.js";

import {
    getMessages,
    sendMessage,
    deleteMessage
} from "../controllers/messageController.js";

const router = express.Router();

router.get("/:chatId", auth, getMessages);
router.post("/:chatId", auth, sendMessage);
router.delete("/:chatId/:messageId", auth, deleteMessage);

export default router;