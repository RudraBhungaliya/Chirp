import express from "express";
import { googleAuth, devLogin } from "../controllers/authController.js";

const router = express.Router();

router.post("/google", googleAuth);
router.post("/dev-login", devLogin);

export default router;
