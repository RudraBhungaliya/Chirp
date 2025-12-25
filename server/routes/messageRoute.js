import express from "express";
import auth from "../middleware/auth.js";

import {
    getMessages,
    sendMessage
} from "../controllers/messageController.js";

const router = express.Router();

router.get("/:chatID", auth, getMessages);
router.post("/:chatId", auth, sendMessage);

export default router;