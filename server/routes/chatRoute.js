import express from "express";
import auth from "../middleware/auth.js";

import { createChat, getChats } from "../controllers/chatController.js";
const router = express.Router();

router.post("/", auth, createChat);
router.get("/", auth, getChats);

export default router;