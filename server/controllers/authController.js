import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(400).json({ msg: "GOOGLE_CLIENT_ID is not configured on the server" });
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    let user = await User.findOne({
      googleId: sub,
    });

    if (!user) {
      user = await User.create({
        googleId: sub,
        email,
        displayName: name || email.split("@")[0],
        userName: email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") + "_" + Math.random().toString(36).substring(2, 6),
        avatar: picture || "",
        isProfileComplete: true,
      });
    }

    const secret = process.env.JWT_SECRET || "chirp_jwt_secret_dev_key";
    const token = jwt.sign({ userId: user._id }, secret, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user,
      needsProfile: false,
    });
  } catch (err) {
    console.error("Google auth failed:", err.message);
    res.status(401).json({ msg: "Google auth failed" });
  }
};

export const devLogin = async (req, res) => {
  try {
    const { name = "Dev User", email = "dev@example.com" } = req.body || {};
    const safeEmail = email.toLowerCase().trim();
    const googleId = `dev_${Buffer.from(safeEmail).toString("hex")}`;

    let user = await User.findOne({
      $or: [{ googleId }, { email: safeEmail }],
    });

    if (!user) {
      user = await User.create({
        googleId,
        email: safeEmail,
        displayName: name,
        userName: `user_${Math.random().toString(36).substring(2, 7)}`,
        avatar: "",
        isProfileComplete: true,
      });
    }

    const secret = process.env.JWT_SECRET || "chirp_jwt_secret_dev_key";
    const token = jwt.sign({ userId: user._id }, secret, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user,
      needsProfile: false,
    });
  } catch (err) {
    console.error("Dev login error:", err);
    res.status(500).json({ msg: "Dev login failed" });
  }
};
