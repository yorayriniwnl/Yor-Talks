/**
 * Yor Talks — Live Streaming Routes
 * Go live, manage streams, viewer counts, live chat, replay storage
 */
const router = require("express").Router();
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

// ─── Go Live ──────────────────────────────────────────────────────────────────

// POST /api/live/start — start a live session
router.post("/start", requireAuth, (req, res) => {
  const { title, category = "general", allow_guests = false } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });

  // End any existing live sessions for this user
  db.prepare("UPDATE live_sessions SET status='ended', ended_at=datetime('now') WHERE host_id=? AND status='live'").run(req.userId);

  const id = uuidv4();
  const streamKey = uuidv4().replace(/-/g, "").slice(0, 24);

  db.prepare(`
    INSERT INTO live_sessions (id, host_id, title, category, stream_key, status, viewer_count, peak_viewers, allow_guests, started_at, created_at)
    VALUES (?,?,?,?,?,?,0,0,?,datetime('now'),datetime('now'))
  `).run(id, req.userId, title, category, streamKey, "live", allow_guests ? 1 : 0);

  db.prepare("UPDATE users SET is_live=1 WHERE id=?").run(req.userId);

  // Notify followers
  const followers = db.prepare("SELECT follower_id FROM follows WHERE following_id=? LIMIT 500").all(req.userId);
  const user = db.prepare("SELECT username, name FROM users WHERE id=?").get(req.userId);
  const notifStmt = db.prepare("INSERT INTO notifications (id, user_id, type, from_user_id, data, created_at) VALUES (?,?,?,?,?,datetime('now'))");
  followers.forEach(f => {
    notifStmt.run(uuidv4(), f.follower_id, "user_live", req.userId, JSON.stringify({ username: user.username, title, session_id: id }));
  });

  res.json({
    success: true,
    session: { id, stream_key: streamKey, title, status: "live" },
    rtmp_url: `rtmp://stream.yortalks.com/live/${streamKey}`,
    playback_url: `https://stream.yortalks.com/hls/${id}/index.m3u8`,
  });
});

// POST /api/live/end — end live session
router.post("/end", requireAuth, (req, res) => {
  const session = db.prepare("SELECT * FROM live_sessions WHERE host_id=? AND status='live'").get(req.userId);
  if (!session) return res.status(404).json({ error: "No active stream" });

  const duration = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000);
  db.prepare(`
    UPDATE live_sessions SET status='ended', ended_at=datetime('now'), duration_seconds=?
    WHERE id=?
  `).run(duration, session.id);
  db.prepare("UPDATE users SET is_live=0 WHERE id=?").run(req.userId);

  res.json({ success: true, duration_seconds: duration, peak_viewers: session.peak_viewers, total_viewers: session.viewer_count });
});

// GET /api/live/active — get all active live sessions
router.get("/active", optionalAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT ls.*, u.username, u.name, u.avatar, u.verified
    FROM live_sessions ls
    JOIN users u ON u.id=ls.host_id
    WHERE ls.status='live'
    ORDER BY ls.viewer_count DESC LIMIT 20
  `).all();
  res.json({ sessions });
});

// GET /api/live/session/:id — get session details
router.get("/session/:id", optionalAuth, (req, res) => {
  const session = db.prepare(`
    SELECT ls.*, u.username, u.name, u.avatar, u.verified, u.followers_count
    FROM live_sessions ls
    JOIN users u ON u.id=ls.host_id
    WHERE ls.id=?
  `).get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const chatMessages = db.prepare(`
    SELECT lc.*, u.username, u.name, u.avatar, u.verified
    FROM live_chat lc JOIN users u ON u.id=lc.user_id
    WHERE lc.session_id=? ORDER BY lc.created_at DESC LIMIT 50
  `).all(req.params.id).reverse();

  res.json({ session, chat: chatMessages });
});

// POST /api/live/session/:id/join — join as viewer
router.post("/session/:id/join", requireAuth, (req, res) => {
  const session = db.prepare("SELECT id, host_id FROM live_sessions WHERE id=? AND status='live'").get(req.params.id);
  if (!session) return res.status(404).json({ error: "Stream not found or ended" });

  // Track viewer
  const existing = db.prepare("SELECT id FROM live_viewers WHERE session_id=? AND user_id=?").get(req.params.id, req.userId);
  if (!existing) {
    db.prepare("INSERT OR IGNORE INTO live_viewers (id, session_id, user_id, joined_at) VALUES (?,?,?,datetime('now'))").run(uuidv4(), req.params.id, req.userId);
    db.prepare("UPDATE live_sessions SET viewer_count=viewer_count+1, peak_viewers=MAX(peak_viewers, viewer_count+1) WHERE id=?").run(req.params.id);
  }

  res.json({ success: true, playback_url: `https://stream.yortalks.com/hls/${req.params.id}/index.m3u8` });
});

// POST /api/live/session/:id/leave — leave stream
router.post("/session/:id/leave", requireAuth, (req, res) => {
  db.prepare("UPDATE live_sessions SET viewer_count=MAX(0,viewer_count-1) WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// POST /api/live/session/:id/chat — send chat message
router.post("/session/:id/chat", requireAuth, (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Message required" });

  const session = db.prepare("SELECT id FROM live_sessions WHERE id=? AND status='live'").get(req.params.id);
  if (!session) return res.status(404).json({ error: "Stream not active" });

  const id = uuidv4();
  db.prepare("INSERT INTO live_chat (id, session_id, user_id, message, created_at) VALUES (?,?,?,?,datetime('now'))").run(
    id, req.params.id, req.userId, message.trim().slice(0, 200)
  );

  const user = db.prepare("SELECT username, name, avatar, verified FROM users WHERE id=?").get(req.userId);
  res.json({ success: true, chat: { id, message: message.trim(), user, created_at: new Date().toISOString() } });
});

// POST /api/live/session/:id/react — react to stream
router.post("/session/:id/react", requireAuth, (req, res) => {
  const { emoji = "❤️" } = req.body;
  db.prepare("UPDATE live_sessions SET reaction_count=reaction_count+1 WHERE id=?").run(req.params.id);
  res.json({ success: true, emoji });
});

// GET /api/live/history — my past streams
router.get("/history", requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT * FROM live_sessions WHERE host_id=? AND status='ended'
    ORDER BY started_at DESC LIMIT 20
  `).all(req.userId);
  res.json({ sessions });
});

// GET /api/live/following — live sessions from people I follow
router.get("/following", requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT ls.*, u.username, u.name, u.avatar, u.verified
    FROM live_sessions ls
    JOIN users u ON u.id=ls.host_id
    JOIN follows f ON f.following_id=ls.host_id
    WHERE f.follower_id=? AND ls.status='live'
    ORDER BY ls.viewer_count DESC
  `).all(req.userId);
  res.json({ sessions });
});

module.exports = router;
