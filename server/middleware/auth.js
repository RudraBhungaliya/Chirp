import jwt from "jsonwebtoken";

export default function auth( req, res, next ) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "No token provided " });
  }

  // Bearer tokenString
  const token = header.split(" ")[1];

  if (!token) {
    res.status(401).json({ msg: "No token string provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token is not valid" });
  }
}
