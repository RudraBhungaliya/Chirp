import express from "express";
import auth from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  getMessages,
  sendMessage,
  sendFileMessage,
  markChatAsRead,
  deleteMessage,
  getFile,
} from "../controllers/messageController.js";

const router = express.Router();

router.get("/:chatId", auth, getMessages);
router.post("/:chatId", auth, sendMessage);
router.put("/:chatId/read", auth, markChatAsRead);
router.delete("/:chatId/:messageId", auth, deleteMessage);
router.post("/:chatId/file", auth, upload.single("file"), sendFileMessage);

// Public media streaming route with HTTP Range & browser caching
router.get("/file/:id", getFile);

export default router;
