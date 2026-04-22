require("dotenv").config();
const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const path       = require("path");
const cors       = require("cors");
const helmet     = require("helmet");
const compression= require("compression");
const morgan     = require("morgan");
const rateLimit  = require("express-rate-limit");
const jwt        = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const db = require("./db");
const cache = require("./utils/cache");
const { startJobs } = require("./utils/jobs");
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const { usersRouter, storiesRouter, messagesRouter, notifsRouter, searchRouter, adminRouter, analyticsRouter, exploreRouter } = require("./routes/misc");
const { JWT_SECRET } = require("./middleware/auth");

const app  = express();
const srv  = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// ── Security ──────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy:"cross-origin" }, contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit:"10mb" }));
app.use(express.urlencoded({ extended: true, limit:"10mb" }));
app.use(morgan(process.env.NODE_ENV==="production" ? "combined" : "dev"));

// ── Rate Limits ───────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({ windowMs:15*60*1000, max:600, standardHeaders:true, legacyHeaders:false, message: { error:"Too many requests" } });
const authLimiter   = rateLimit({ windowMs:15*60*1000, max:15,  message: { error:"Too many auth attempts. Try again later." } });
const uploadLimiter = rateLimit({ windowMs:60*1000,    max:20,  message: { error:"Upload limit reached. Try again shortly." } });

app.use("/api", globalLimiter);
app.use("/api/auth/login",           authLimiter);
app.use("/api/auth/register",        authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/posts",                (req, res, next) => { if(req.method==="POST") uploadLimiter(req,res,next); else next(); });

// ── Static uploads ────────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "30d",
  setHeaders: (res) => { res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); }
}));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/posts",     postRoutes);
app.use("/api/users",     usersRouter);
app.use("/api/stories",   storiesRouter);
app.use("/api/messages",  messagesRouter);
app.use("/api/notifs",    notifsRouter);
app.use("/api/search",    searchRouter);
app.use("/api/admin",     adminRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/explore",   exploreRouter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({
  status:"ok", version:"2.0.0", uptime: Math.round(process.uptime()),
  timestamp: new Date().toISOString(),
  db: { users: db.prepare("SELECT COUNT(*) as c FROM users").get().c, posts: db.prepare("SELECT COUNT(*) as c FROM posts").get().c, stories: db.prepare("SELECT COUNT(*) as c FROM stories WHERE expires_at > datetime('now')").get().c },
  cache: { size: cache.size() },
}));

app.get("/api/cache/stats", (req, res) => res.json({ size: cache.size() }));

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(srv, {
  cors: { origin: CLIENT_URL, credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 5000,
});

const onlineUsers = new Map(); // userId → Set<socketId>

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "access") return next(new Error("Wrong token type"));
    socket.userId = payload.userId;
    next();
  } catch { next(new Error("Invalid token")); }
});

io.on("connection", (socket) => {
  const uid = socket.userId;
  socket.join(`user:${uid}`);

  // Track online
  if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
  onlineUsers.get(uid).add(socket.id);
  io.emit("presence", { userId: uid, online: true });

  // ── DM ──────────────────────────────────────────────────────────────────────
  socket.on("join_conversation", (convId) => {
    const ok = db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?").get(convId, uid);
    if (ok) socket.join(`conv:${convId}`);
  });

  socket.on("send_message", ({ conversation_id, text, media_url, reply_to_id, shared_post_id }) => {
    const ok = db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?").get(conversation_id, uid);
    if (!ok || (!text && !media_url)) return;

    const mid = uuidv4();
    const mediaType = media_url ? (media_url.match(/\.(mp4|mov|webm)$/i) ? "video" : "image") : "text";
    db.prepare("INSERT INTO messages (id,conversation_id,sender_id,text,media_url,media_type,reply_to_id,shared_post_id) VALUES (?,?,?,?,?,?,?,?)").run(mid, conversation_id, uid, text||null, media_url||null, mediaType, reply_to_id||null, shared_post_id||null);
    db.prepare("UPDATE conversations SET updated_at=datetime('now'), last_message_id=? WHERE id=?").run(mid, conversation_id);

    const sender = db.prepare("SELECT id,username,name,avatar FROM users WHERE id=?").get(uid);
    const msg = { id: mid, conversation_id, sender_id: uid, text, media_url, media_type: mediaType, reply_to_id, shared_post_id, reactions: "{}", created_at: new Date().toISOString(), sender: { ...sender, avatar: sender?.avatar || `https://i.pravatar.cc/150?u=${uid}` } };

    io.to(`conv:${conversation_id}`).emit("new_message", msg);

    // Push notification to offline members
    const members = db.prepare("SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id!=?").all(conversation_id, uid);
    members.forEach(m => {
      if (!onlineUsers.has(m.user_id) || !onlineUsers.get(m.user_id).size) {
        db.prepare("INSERT INTO notifications (id,user_id,actor_id,type,entity_id,entity_type) VALUES (?,?,?,?,?,?)").run(uuidv4(), m.user_id, uid, "message", conversation_id, "conversation");
      }
    });
  });

  socket.on("react_message", ({ message_id, emoji }) => {
    const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(message_id);
    if (!msg) return;
    let reactions = {};
    try { reactions = JSON.parse(msg.reactions || "{}"); } catch {}
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(uid);
    if (idx >= 0) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push(uid);
    if (!reactions[emoji].length) delete reactions[emoji];
    db.prepare("UPDATE messages SET reactions=? WHERE id=?").run(JSON.stringify(reactions), message_id);
    io.to(`conv:${msg.conversation_id}`).emit("message_reaction", { message_id, reactions });
  });

  socket.on("typing", ({ conversation_id, is_typing }) => {
    socket.to(`conv:${conversation_id}`).emit("typing", { user_id: uid, is_typing, username: socket.handshake.auth.username });
  });

  socket.on("read_conversation", (conversation_id) => {
    db.prepare("UPDATE conversation_members SET last_read_at=datetime('now') WHERE conversation_id=? AND user_id=?").run(conversation_id, uid);
    socket.to(`conv:${conversation_id}`).emit("conversation_read", { user_id: uid, conversation_id });
  });

  // ── Real-time feed ───────────────────────────────────────────────────────────
  socket.on("post_liked", ({ post_id }) => {
    socket.broadcast.emit("post_stats_update", { post_id, user_id: uid });
  });

  socket.on("new_story", ({ user_id }) => {
    socket.broadcast.emit("story_added", { user_id });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const set = onlineUsers.get(uid);
    if (set) { set.delete(socket.id); if (!set.size) { onlineUsers.delete(uid); io.emit("presence", { userId: uid, online: false }); } }
    db.prepare("UPDATE users SET last_seen=datetime('now') WHERE id=?").run(uid);
  });
});

// Expose online users
app.get("/api/online", (req, res) => res.json({ online: [...onlineUsers.keys()], count: onlineUsers.size }));

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error:"File too large (max 50MB)" });
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
srv.listen(PORT, () => {
  const u = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const p = db.prepare("SELECT COUNT(*) as c FROM posts").get().c;
  startJobs();
console.log(`\n🚀 Yor Talks API v2.0 → http://localhost:${PORT}`);
  console.log(`📦 DB: ${u} users · ${p} posts`);
  console.log(`🌐 CORS: ${CLIENT_URL}`);
  console.log(`\n📱 Frontend: ${CLIENT_URL}`);
  console.log(`🔧 Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = { app, io };

// Additional routes (appended)
const collectionsRouter = require("./routes/collections");
const activityRouter    = require("./routes/activity");
app.use("/api/collections", collectionsRouter);
app.use("/api/activity",    activityRouter);
