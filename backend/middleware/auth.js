const jwt = require("jsonwebtoken");
const db  = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "yor-talks-jwt-secret-change-in-production";
const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  || "30m";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || "30d";

const makeAccessToken  = (userId) => jwt.sign({ userId, type: "access" },  JWT_SECRET, { expiresIn: ACCESS_TTL });
const makeRefreshToken = (userId) => jwt.sign({ userId, type: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_TTL });

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type !== "access") return res.status(401).json({ error: "Invalid token type" });
    const user = db.prepare(
      "SELECT id,username,name,avatar,email,is_verified,is_admin,is_banned,two_factor_enabled FROM users WHERE id=?"
    ).get(payload.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.is_banned) return res.status(403).json({ error: "Account suspended", ban_reason: user.ban_reason });
    req.user = user;
    // Update last_seen
    db.prepare("UPDATE users SET last_seen=datetime('now') WHERE id=?").run(user.id);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
};

const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type === "access") {
      req.user = db.prepare("SELECT id,username,name,avatar,is_verified,is_admin FROM users WHERE id=?").get(payload.userId);
    }
  } catch {}
  next();
};

const adminOnly = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: "Admin access required" });
  next();
};

module.exports = { auth, optionalAuth, adminOnly, makeAccessToken, makeRefreshToken, JWT_SECRET };
