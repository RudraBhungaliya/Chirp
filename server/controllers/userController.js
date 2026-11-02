import User from "../models/User.js";
import { io, isUserOnline, getOnlineUserIds } from "../server.js";

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    user.isActive = isUserOnline(user._id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const completeProfile = async (req, res) => {
  try {
    const { userName, displayName, bio, avatar } = req.body;

    if (!userName || !displayName) {
      return res
        .status(400)
        .json({ msg: "Username and display name are required" });
    }

    const cleanUserName = userName.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    const exists = await User.findOne({ userName: cleanUserName });
    if (exists && exists._id.toString() !== req.userId) {
      return res.status(400).json({ msg: "Username is already taken" });
    }

    const updateData = {
      userName: cleanUserName,
      displayName: cleanDisplayName,
      bio: bio ? bio.trim() : "Hey there! I am using Chirp.",
      isProfileComplete: true,
    };

    if (avatar) {
      updateData.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(req.userId, updateData, {
      new: true,
    });

    if (io) {
      io.emit("user_updated", {
        _id: user._id,
        displayName: user.displayName,
        userName: user.userName,
        avatar: user.avatar,
        bio: user.bio,
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { userName, displayName, bio, avatar } = req.body;

    if (!userName || !displayName) {
      return res
        .status(400)
        .json({ msg: "Username and display name are required" });
    }

    const cleanUserName = userName.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    const exists = await User.findOne({ userName: cleanUserName });
    if (exists && exists._id.toString() !== req.userId) {
      return res.status(400).json({ msg: "Username is already taken" });
    }

    const updateData = {
      userName: cleanUserName,
      displayName: cleanDisplayName,
      bio: bio ? bio.trim() : "",
    };

    if (avatar) {
      updateData.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(req.userId, updateData, {
      new: true,
    });

    if (io) {
      io.emit("user_updated", {
        _id: user._id,
        displayName: user.displayName,
        userName: user.userName,
        avatar: user.avatar,
        bio: user.bio,
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.status(200).json([]);
    }

    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { userName: { $regex: q, $options: "i" } },
        { displayName: { $regex: q, $options: "i" } },
      ],
    })
      .select("_id userName displayName avatar isActive lastSeen")
      .limit(20)
      .lean();

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("_id userName displayName avatar createdAt isActive lastSeen bio")
      .lean();

    const onlineIds = new Set(getOnlineUserIds().map(String));
    const formatted = users.map((u) => ({
      ...u,
      isActive: onlineIds.has(String(u._id)),
    }));

    // Sort: online users first, then by lastSeen / createdAt
    formatted.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return new Date(b.lastSeen || b.createdAt || 0) - new Date(a.lastSeen || a.createdAt || 0);
    });

    res.status(200).json(formatted);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
