const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const { authenticator } = require("otplib");
const db = require("../db");
const { auth, makeAccessToken, makeRefreshToken } = require("../middleware/auth");
const { upload, processAvatar } = require("../middleware/upload");
const emailSvc = require("../utils/email");
const cache = require("../utils/cache");

const validate = (req, res) => {
  const e = validationResult(req);
  if (!e.isEmpty()) { res.status(422).json({ errors: e.array() }); return false; }
  return true;
};

const storeRefresh = (userId, token, req) => {
  const exp = new Date(Date.now() + 30*24*3600*1000).toISOString();
  const device = req.headers["user-agent"]?.slice(0, 100) || "";
  const ip = req.ip || "";
  db.prepare("INSERT INTO refresh_tokens (id,user_id,token,device,ip,expires_at) VALUES (?,?,?,?,?,?)").run(uuidv4(), userId, token, device, ip, exp);
};

const userFull = (u) => ({
  id: u.id, username: u.username, name: u.name, email: u.email,
  bio: u.bio || "", avatar: u.avatar || `https://i.pravatar.cc/150?u=${u.id}`,
  website: u.website || "", phone: u.phone || "", gender: u.gender || "",
  is_private: !!u.is_private, is_verified: !!u.is_verified, is_admin: !!u.is_admin,
  email_verified: !!u.email_verified, two_factor_enabled: !!u.two_factor_enabled,
  show_activity: !!u.show_activity, allow_tagging: u.allow_tagging,
  followers_count: u.followers_count, following_count: u.following_count, posts_count: u.posts_count,
  created_at: u.created_at,
});

// POST /api/auth/register
router.post("/register", [
  body("username").trim().isLength({min:3,max:30}).matches(/^[a-zA-Z0-9._]+$/).withMessage("Username: letters, numbers, dots, underscores only"),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({min:8}).withMessage("Password must be at least 8 characters"),
  body("name").trim().isLength({min:1,max:60}),
], async (req, res) => {
  if (!validate(req, res)) return;
  const { username, email, password, name } = req.body;
  const existing = db.prepare("SELECT id FROM users WHERE email=? OR username=?").get(email, username);
  if (existing) return res.status(409).json({ error: "Username or email already taken" });

  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 12);
  const verifyToken = uuidv4();
  db.prepare(`INSERT INTO users (id,username,email,password,name,avatar,email_verify_token) VALUES (?,?,?,?,?,?,?)`)
    .run(id, username, email, hashed, name, `https://i.pravatar.cc/150?u=${id}`, verifyToken);

  emailSvc.sendVerification(email, name, verifyToken).catch(() => {});
  emailSvc.sendWelcome(email, name).catch(() => {});

  const access  = makeAccessToken(id);
  const refresh = makeRefreshToken(id);
  storeRefresh(id, refresh, req);

  const user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  res.status(201).json({ user: userFull(user), access, refresh });
});

// POST /api/auth/login
router.post("/login", [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
], async (req, res) => {
  if (!validate(req, res)) return;
  const { email, password, totp_code } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (user.is_banned) return res.status(403).json({ error: "Account suspended" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  // 2FA check
  if (user.two_factor_enabled && user.two_factor_secret) {
    if (!totp_code) return res.status(200).json({ requires_2fa: true });
    const ok = authenticator.verify({ token: totp_code, secret: user.two_factor_secret });
    if (!ok) return res.status(401).json({ error: "Invalid 2FA code" });
  }

  const access  = makeAccessToken(user.id);
  const refresh = makeRefreshToken(user.id);
  storeRefresh(user.id, refresh, req);

  res.json({ user: userFull(user), access, refresh });
});

// POST /api/auth/refresh
router.post("/refresh", (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(401).json({ error: "No refresh token" });
  const jwt = require("jsonwebtoken");
  const { JWT_SECRET } = require("../middleware/auth");
  try {
    const payload = jwt.verify(refresh, JWT_SECRET);
    if (payload.type !== "refresh") throw new Error("Wrong type");
    const stored = db.prepare("SELECT * FROM refresh_tokens WHERE token=?").get(refresh);
    if (!stored || new Date(stored.expires_at) < new Date()) return res.status(401).json({ error: "Refresh token expired" });
    db.prepare("DELETE FROM refresh_tokens WHERE token=?").run(refresh);
    const access2  = makeAccessToken(payload.userId);
    const refresh2 = makeRefreshToken(payload.userId);
    storeRefresh(payload.userId, refresh2, req);
    res.json({ access: access2, refresh: refresh2 });
  } catch { res.status(401).json({ error: "Invalid refresh token" }); }
});

// POST /api/auth/logout
router.post("/logout", auth, (req, res) => {
  const { refresh } = req.body;
  if (refresh) db.prepare("DELETE FROM refresh_tokens WHERE token=?").run(refresh);
  else db.prepare("DELETE FROM refresh_tokens WHERE user_id=?").run(req.user.id);
  cache.delPattern(`user:${req.user.id}:*`);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user: userFull(user) });
});

// PATCH /api/auth/me
router.patch("/me", auth, [
  body("name").optional().trim().isLength({min:1,max:60}),
  body("bio").optional().isLength({max:150}),
  body("website").optional().custom(v => !v || v.startsWith("http")).withMessage("Invalid URL"),
  body("phone").optional().isMobilePhone().withMessage("Invalid phone"),
  body("gender").optional().isIn(["male","female","other",""]),
], (req, res) => {
  if (!validate(req, res)) return;
  const allowed = ["name","bio","website","phone","gender","show_activity","allow_tagging","is_private"];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });
  const sets = Object.keys(updates).map(k => `${k}=@${k}`).join(", ");
  db.prepare(`UPDATE users SET ${sets}, updated_at=datetime('now') WHERE id=@id`).run({ ...updates, id: req.user.id });
  cache.del(`user:${req.user.id}`);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user: userFull(user) });
});

// POST /api/auth/avatar
router.post("/avatar", auth, upload.avatar, processAvatar, (req, res) => {
  if (!req.file?.url) return res.status(400).json({ error: "No file" });
  db.prepare("UPDATE users SET avatar=? WHERE id=?").run(req.file.url, req.user.id);
  cache.del(`user:${req.user.id}`);
  res.json({ avatar: req.file.url });
});

// POST /api/auth/change-password
router.post("/change-password", auth, [
  body("current").notEmpty(),
  body("newPassword").isLength({min:8}),
], async (req, res) => {
  if (!validate(req, res)) return;
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  const ok = await bcrypt.compare(req.body.current, user.password);
  if (!ok) return res.status(403).json({ error: "Current password incorrect" });
  const h = await bcrypt.hash(req.body.newPassword, 12);
  db.prepare("UPDATE users SET password=? WHERE id=?").run(h, req.user.id);
  db.prepare("DELETE FROM refresh_tokens WHERE user_id=?").run(req.user.id);
  res.json({ ok: true });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", [body("email").isEmail().normalizeEmail()], async (req, res) => {
  if (!validate(req, res)) return;
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(req.body.email);
  if (!user) return res.json({ ok: true }); // don't leak existence
  const token = uuidv4();
  const exp = new Date(Date.now() + 3600*1000).toISOString();
  db.prepare("INSERT INTO password_resets (id,user_id,token,expires_at) VALUES (?,?,?,?)").run(uuidv4(), user.id, token, exp);
  emailSvc.sendPasswordReset(user.email, user.name, token).catch(() => {});
  res.json({ ok: true });
});

// POST /api/auth/reset-password
router.post("/reset-password", [
  body("token").notEmpty(),
  body("password").isLength({min:8}),
], async (req, res) => {
  if (!validate(req, res)) return;
  const reset = db.prepare("SELECT * FROM password_resets WHERE token=? AND used=0").get(req.body.token);
  if (!reset || new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: "Invalid or expired token" });
  const h = await bcrypt.hash(req.body.password, 12);
  db.prepare("UPDATE users SET password=? WHERE id=?").run(h, reset.user_id);
  db.prepare("UPDATE password_resets SET used=1 WHERE id=?").run(reset.id);
  db.prepare("DELETE FROM refresh_tokens WHERE user_id=?").run(reset.user_id);
  res.json({ ok: true });
});

// GET /api/auth/verify-email?token=
router.get("/verify-email", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE email_verify_token=?").get(req.query.token);
  if (!user) return res.status(400).json({ error: "Invalid verification token" });
  db.prepare("UPDATE users SET email_verified=1, email_verify_token=NULL WHERE id=?").run(user.id);
  res.json({ ok: true });
});

// POST /api/auth/2fa/setup
router.post("/2fa/setup", auth, (req, res) => {
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(req.user.email, "Yor Talks", secret);
  // Store temporarily in cache
  cache.set(`2fa_setup:${req.user.id}`, secret, 300);
  res.json({ secret, uri });
});

// POST /api/auth/2fa/enable
router.post("/2fa/enable", auth, [body("code").notEmpty()], (req, res) => {
  const secret = cache.get(`2fa_setup:${req.user.id}`);
  if (!secret) return res.status(400).json({ error: "No 2FA setup in progress" });
  const ok = authenticator.verify({ token: req.body.code, secret });
  if (!ok) return res.status(400).json({ error: "Invalid code" });
  db.prepare("UPDATE users SET two_factor_secret=?, two_factor_enabled=1 WHERE id=?").run(secret, req.user.id);
  cache.del(`2fa_setup:${req.user.id}`);
  res.json({ ok: true });
});

// POST /api/auth/2fa/disable
router.post("/2fa/disable", auth, [body("code").notEmpty()], (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  const ok = authenticator.verify({ token: req.body.code, secret: user.two_factor_secret });
  if (!ok) return res.status(400).json({ error: "Invalid code" });
  db.prepare("UPDATE users SET two_factor_secret=NULL, two_factor_enabled=0 WHERE id=?").run(req.user.id);
  res.json({ ok: true });
});

// GET /api/auth/sessions
router.get("/sessions", auth, (req, res) => {
  const sessions = db.prepare("SELECT id,device,ip,created_at,expires_at FROM refresh_tokens WHERE user_id=? ORDER BY created_at DESC").all(req.user.id);
  res.json({ sessions });
});

// DELETE /api/auth/sessions/:id
router.delete("/sessions/:id", auth, (req, res) => {
  db.prepare("DELETE FROM refresh_tokens WHERE id=? AND user_id=?").run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// POST /api/auth/gdpr/export — GDPR data export
router.post("/gdpr/export", auth, (req, res) => {
  const uid = req.user.id;
  const user = db.prepare("SELECT username,name,email,bio,website,created_at FROM users WHERE id=?").get(uid);
  const posts = db.prepare("SELECT id,caption,location,created_at FROM posts WHERE user_id=? AND is_archived=0").all(uid);
  const comments = db.prepare("SELECT id,text,created_at FROM comments WHERE user_id=?").all(uid);
  const likes = db.prepare("SELECT post_id,created_at FROM likes WHERE user_id=?").all(uid);
  const follows = db.prepare("SELECT following_id,created_at FROM follows WHERE follower_id=?").all(uid);
  res.json({ data: { user, posts, comments, likes, follows, exported_at: new Date().toISOString() } });
});

// DELETE /api/auth/account — full account deletion
router.delete("/account", auth, [body("password").notEmpty()], async (req, res) => {
  if (!validate(req, res)) return;
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.status(403).json({ error: "Incorrect password" });
  db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
