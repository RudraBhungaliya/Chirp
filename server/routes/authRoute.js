import express from "express";
import { googleAuth } from "../controllers/authController.js";

const router = express.Router();

router.post("/google", googleAuth);

export default router;