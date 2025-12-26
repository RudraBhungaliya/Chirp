import express from "express";
import auth from "../middleware/auth.js";

import { completeProfile, getMe } from "../controllers/userController.js";

const router = express.Router();

router.get("/me", auth, getMe);

router.post("/complete-profile", auth, completeProfile);

export default router;
