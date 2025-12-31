import multer from "multer";

// Use memory storage so we can persist files to GridFS (MongoDB) instead of ephemeral disk
const storage = multer.memoryStorage();

export const upload = multer({ storage });
