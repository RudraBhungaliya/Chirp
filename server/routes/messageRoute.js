import express from "express";
import auth from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { sendFileMessage, getFile } from "../controllers/messageController.js";

import {
    getMessages,
    sendMessage,
    deleteMessage
} from "../controllers/messageController.js";

const router = express.Router();

router.get("/:chatId", auth, getMessages);
router.post("/:chatId", auth, sendMessage);
router.delete("/:chatId/:messageId", auth, deleteMessage);
router.post("/:chatId/file", auth, upload.single("file"), sendFileMessage);
// file serving should be public so browsers can GET media resources without an auth header
router.get("/file/:id", getFile);

export default router;