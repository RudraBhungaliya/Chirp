import express from "express";
import auth from "../middleware/auth.js";

import { completeProfile, getMe, updateProfile, getAllUsers } from "../controllers/userController.js";

const router = express.Router();

router.get("/me", auth, getMe);

router.post("/complete-profile", auth, completeProfile);

router.put("/profile", auth, updateProfile);

router.get("/search", auth, searchUsers);

router.get("/", auth, getAllUsers);

export default router;
