import User from "../models/User.js";

export const getMe = async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(user);
};

export const completeProfile = async (req, res) => {
  const { userName, displayName, bio, avatar } = req.body;

  if (!userName || !displayName) {
    return res
      .status(400)
      .json({ msg: "Username and displayname are required" });
  }

  const exists = await User.findOne({ userName });
  if (exists && exists._id.toString() !== req.userId) {
    return res.status(400).json({ msg: "Username already taken" });
  }

  const updateData = {
    userName,
    displayName,
    bio,
    isProfileComplete: true,
  };

  if (avatar) {
    updateData.avatar = avatar;
  }

  const user = await User.findByIdAndUpdate(req.userId, updateData, {
    new: true,
  });

  res.json(user);
};

export const updateProfile = async (req, res) => {
  const { userName, displayName, bio, avatar } = req.body;

  if (!userName || !displayName) {
    return res
      .status(400)
      .json({ msg: "Username and displayname are required" });
  }

  const exists = await User.findOne({ userName });
  if (exists && exists._id.toString() !== req.userId) {
    return res.status(400).json({ msg: "Username already taken" });
  }

  const updateData = {
    userName,
    displayName,
    bio,
  };

  if (avatar) {
    updateData.avatar = avatar;
  }

  const user = await User.findByIdAndUpdate(req.userId, updateData, {
    new: true,
  });

  res.json(user);
};

export const searchUsers = async (req, res) => {
  try {
    const q = req.query.q || "";

    const users = await User.find({
      $or: [
        { userName: { $regex: q, $options: "i" } },
        { displayName: { $regex: q, $options: "i" } },
      ],
    }).select("_id userName displayName avatar");

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("_id userName displayName avatar createdAt isActive lastSeen")
      .sort({ createdAt: 1 });

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
