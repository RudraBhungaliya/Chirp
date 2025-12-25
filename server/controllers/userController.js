import User from "../models/User.js";

export const getMe = async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(user);
};

export const completeProfile = async (req, res) => {
  const { userName, displayName, bio } = req.body;

  if (!userName || !displayName) {
    return res
      .status(400)
      .json({ msg: "Username and displayname are required" });
  }

  const exists = await User.findOne({ userName });
  if (exists && exists._id.toString() !== req.userId) {
    return res.status(400).json({ msg: "Username already taken" });
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    {
      userName,
      displayName,
      bio,
      isProfileComplete: true,
    },
    {
      new: true,
    }
  );

  res.json(user);
};
