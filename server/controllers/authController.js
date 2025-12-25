import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
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
        displayName: name,
        avatar: picture,
        isProfileComplete: false,
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user,
      needsProfile: !user.isProfileComplete,
    });
  } catch (err) {
    res.status(401).json({ msg: "Google auth failed" });
  }
};
