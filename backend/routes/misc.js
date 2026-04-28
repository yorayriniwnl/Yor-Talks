// ─── USERS ────────────────────────────────────────────────────────────────────
const usersRouter = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { auth, optionalAuth } = require("../middleware/auth");
const { userMini, pushNotif, paginateResp, paginate } = require("../utils/helpers");

const profileView = (u, viewerId) => {
  const isMe = viewerId === u.id;
  const isFollowing = viewerId && !isMe ? !!db.prepare("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?").get(viewerId, u.id) : false;
  const isBlocked   = viewerId && !isMe ? !!db.prepare("SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?").get(viewerId, u.id) : false;
  const hasRequested= viewerId && !isMe ? !!db.prepare("SELECT 1 FROM follow_requests WHERE requester_id=? AND target_id=? AND status='pending'").get(viewerId, u.id) : false;
  return {
    id: u.id, username: u.username, name: u.name,
    bio: u.bio||"", avatar: u.avatar||`https://i.pravatar.cc/150?u=${u.id}`,
    website: u.website||"", is_private: !!u.is_private, is_verified: !!u.is_verified,
    is_banned: !!u.is_banned,
    followers_count: u.followers_count, following_count: u.following_count, posts_count: u.posts_count,
    show_activity: !!u.show_activity, last_seen: u.show_activity ? u.last_seen : null,
    created_at: u.created_at,
    is_following: isFollowing, is_blocked: isBlocked, has_requested: hasRequested, is_me: isMe,
  };
};

usersRouter.get("/search", optionalAuth, (req, res) => {
  const q = `%${req.query.q||""}%`;
  const users = db.prepare("SELECT * FROM users WHERE (username LIKE ? OR name LIKE ?) AND is_banned=0 LIMIT 20").all(q, q);
  res.json({ users: users.map(u => profileView(u, req.user?.id)) });
});

usersRouter.get("/suggestions", auth, (req, res) => {
  const users = db.prepare(`
    SELECT * FROM users WHERE id != ? AND is_banned=0
    AND id NOT IN (SELECT following_id FROM follows WHERE follower_id=?)
    AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?)
    ORDER BY followers_count DESC LIMIT 15
  `).all(req.user.id, req.user.id, req.user.id);
  res.json({ users: users.map(u => profileView(u, req.user.id)) });
});

usersRouter.get("/:username", optionalAuth, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE username=?").get(req.params.username);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json({ user: profileView(u, req.user?.id) });
});

usersRouter.get("/:username/posts", optionalAuth, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE username=?").get(req.params.username);
  if (!u) return res.status(404).json({ error: "Not found" });
  const { page, limit, offset } = paginate(req, 12, 30);
  const posts = db.prepare("SELECT * FROM posts WHERE user_id=? AND is_archived=0 AND is_draft=0 ORDER BY created_at DESC LIMIT ? OFFSET ?").all(u.id, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM posts WHERE user_id=? AND is_archived=0 AND is_draft=0").get(u.id).c;
  const { postView } = require("../utils/helpers");
  res.json(paginateResp(posts.map(p => postView(p, req.user?.id)), total, page, limit));
});

usersRouter.get("/:username/followers", optionalAuth, (req, res) => {
  const u = db.prepare("SELECT id FROM users WHERE username=?").get(req.params.username);
  if (!u) return res.status(404).json({ error: "Not found" });
  const { limit, offset } = paginate(req, 30, 100);
  const users = db.prepare(`SELECT u.* FROM users u INNER JOIN follows f ON f.follower_id=u.id WHERE f.following_id=? LIMIT ? OFFSET ?`).all(u.id, limit, offset);
  res.json({ users: users.map(x => profileView(x, req.user?.id)) });
});

usersRouter.get("/:username/following", optionalAuth, (req, res) => {
  const u = db.prepare("SELECT id FROM users WHERE username=?").get(req.params.username);
  if (!u) return res.status(404).json({ error: "Not found" });
  const { limit, offset } = paginate(req, 30, 100);
  const users = db.prepare(`SELECT u.* FROM users u INNER JOIN follows f ON f.following_id=u.id WHERE f.follower_id=? LIMIT ? OFFSET ?`).all(u.id, limit, offset);
  res.json({ users: users.map(x => profileView(x, req.user?.id)) });
});

usersRouter.post("/:username/follow", auth, (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE username=?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "Not found" });
  if (target.id === req.user.id) return res.status(400).json({ error: "Cannot follow yourself" });

  const existing = db.prepare("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?").get(req.user.id, target.id);
  if (existing) {
    db.prepare("DELETE FROM follows WHERE follower_id=? AND following_id=?").run(req.user.id, target.id);
    db.prepare("UPDATE users SET followers_count=MAX(0,followers_count-1) WHERE id=?").run(target.id);
    db.prepare("UPDATE users SET following_count=MAX(0,following_count-1) WHERE id=?").run(req.user.id);
    return res.json({ is_following: false });
  }

  if (target.is_private) {
    const req2 = db.prepare("SELECT * FROM follow_requests WHERE requester_id=? AND target_id=?").get(req.user.id, target.id);
    if (req2) { db.prepare("DELETE FROM follow_requests WHERE id=?").run(req2.id); return res.json({ has_requested: false }); }
    db.prepare("INSERT INTO follow_requests (id,requester_id,target_id) VALUES (?,?,?)").run(uuidv4(), req.user.id, target.id);
    pushNotif(target.id, req.user.id, "follow_request");
    return res.json({ has_requested: true });
  }

  db.prepare("INSERT OR IGNORE INTO follows (follower_id,following_id) VALUES (?,?)").run(req.user.id, target.id);
  db.prepare("UPDATE users SET followers_count=followers_count+1 WHERE id=?").run(target.id);
  db.prepare("UPDATE users SET following_count=following_count+1 WHERE id=?").run(req.user.id);
  pushNotif(target.id, req.user.id, "follow");
  const cache = require("../utils/cache"); cache.delPattern(`feed:${req.user.id}:*`);
  res.json({ is_following: true });
});

usersRouter.post("/:id/follow-requests/:action", auth, (req, res) => {
  const { id, action } = req.params;
  const request = db.prepare("SELECT * FROM follow_requests WHERE id=? AND target_id=?").get(id, req.user.id);
  if (!request) return res.status(404).json({ error: "Not found" });
  if (!["accept","decline"].includes(action)) return res.status(400).json({ error: "Invalid action" });

  db.prepare("DELETE FROM follow_requests WHERE id=?").run(id);
  if (action === "accept") {
    db.prepare("INSERT OR IGNORE INTO follows (follower_id,following_id) VALUES (?,?)").run(request.requester_id, req.user.id);
    db.prepare("UPDATE users SET followers_count=followers_count+1 WHERE id=?").run(req.user.id);
    db.prepare("UPDATE users SET following_count=following_count+1 WHERE id=?").run(request.requester_id);
    pushNotif(request.requester_id, req.user.id, "follow_accepted");
  }
  res.json({ ok: true, action });
});

usersRouter.get("/follow-requests/list", auth, (req, res) => {
  const requests = db.prepare(`
    SELECT fr.*, u.username, u.name, u.avatar FROM follow_requests fr
    INNER JOIN users u ON u.id=fr.requester_id
    WHERE fr.target_id=? AND fr.status='pending' ORDER BY fr.created_at DESC
  `).all(req.user.id);
  res.json({ requests });
});

usersRouter.post("/:username/block", auth, (req, res) => {
  const target = db.prepare("SELECT id FROM users WHERE username=?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "Not found" });
  if (target.id === req.user.id) return res.status(400).json({ error: "Cannot block yourself" });
  const ex = db.prepare("SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?").get(req.user.id, target.id);
  if (ex) {
    db.prepare("DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?").run(req.user.id, target.id);
    return res.json({ is_blocked: false });
  }
  db.prepare("INSERT INTO blocks (blocker_id,blocked_id) VALUES (?,?)").run(req.user.id, target.id);
  db.prepare("DELETE FROM follows WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)").run(req.user.id, target.id, target.id, req.user.id);
  res.json({ is_blocked: true });
});

usersRouter.post("/:username/close-friends", auth, (req, res) => {
  const target = db.prepare("SELECT id FROM users WHERE username=?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "Not found" });
  const ex = db.prepare("SELECT 1 FROM close_friends WHERE user_id=? AND friend_id=?").get(req.user.id, target.id);
  if (ex) { db.prepare("DELETE FROM close_friends WHERE user_id=? AND friend_id=?").run(req.user.id, target.id); return res.json({ is_close_friend: false }); }
  db.prepare("INSERT INTO close_friends (user_id,friend_id) VALUES (?,?)").run(req.user.id, target.id);
  res.json({ is_close_friend: true });
});

usersRouter.get("/tagged/:username", optionalAuth, (req, res) => {
  const u = db.prepare("SELECT id FROM users WHERE username=?").get(req.params.username);
  if (!u) return res.status(404).json({ error: "Not found" });
  const posts = db.prepare(`SELECT p.* FROM posts p INNER JOIN user_tags ut ON ut.post_id=p.id WHERE ut.user_id=? AND p.is_archived=0 ORDER BY p.created_at DESC LIMIT 30`).all(u.id);
  const { postView } = require("../utils/helpers");
  res.json({ posts: posts.map(p => postView(p, req.user?.id)) });
});

module.exports.usersRouter = usersRouter;

// ─── STORIES ──────────────────────────────────────────────────────────────────
const storiesRouter = require("express").Router();
const { upload: uploadMw, processStoryMedia } = require("../middleware/upload");

storiesRouter.get("/feed", auth, (req, res) => {
  const stories = db.prepare(`
    SELECT s.*, u.username, u.name, u.avatar, u.is_verified
    FROM stories s INNER JOIN users u ON u.id=s.user_id
    WHERE s.expires_at > datetime('now')
    AND (s.user_id=? OR (s.user_id IN (SELECT following_id FROM follows WHERE follower_id=?)))
    AND s.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?)
    ORDER BY s.user_id, s.created_at ASC
  `).all(req.user.id, req.user.id, req.user.id);

  const byUser = new Map();
  stories.forEach(s => {
    const seen = !!db.prepare("SELECT 1 FROM story_views WHERE story_id=? AND user_id=?").get(s.id, req.user.id);
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, { user_id: s.user_id, username: s.username, name: s.name, avatar: s.avatar||`https://i.pravatar.cc/150?u=${s.user_id}`, is_verified: !!s.is_verified, all_seen: true, stories: [] });
    const group = byUser.get(s.user_id);
    group.stories.push({ id: s.id, media_url: s.media_url, media_type: s.media_type, text: s.text, text_style: s.text_style, stickers: s.stickers, bg_color: s.bg_color, duration: s.duration, link: s.link, views_count: s.views_count, created_at: s.created_at, is_seen: seen });
    if (!seen) group.all_seen = false;
  });

  const groups = [...byUser.values()].sort((a,b) => a.user_id === req.user.id ? -1 : b.user_id === req.user.id ? 1 : a.all_seen - b.all_seen);
  res.json({ story_groups: groups });
});

storiesRouter.post("/", auth, uploadMw.any, processStoryMedia, (req, res) => {
  const media = req.storyMedia || {};
  const mediaUrl = media.url || req.body.media_url;
  if (!mediaUrl) return res.status(400).json({ error: "Media required" });
  const id = uuidv4();
  db.prepare(`INSERT INTO stories (id,user_id,media_url,media_type,text,text_style,stickers,bg_color,duration,link,audience,expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now','+24 hours'))`).run(id, req.user.id, mediaUrl, media.type||"image", req.body.text||"", req.body.text_style||"{}", req.body.stickers||"[]", req.body.bg_color||"", parseInt(req.body.duration)||5000, req.body.link||"", req.body.audience||"all");
  res.status(201).json({ story: db.prepare("SELECT * FROM stories WHERE id=?").get(id) });
});

storiesRouter.post("/:id/view", auth, (req, res) => {
  const story = db.prepare("SELECT * FROM stories WHERE id=?").get(req.params.id);
  if (!story) return res.status(404).json({ error: "Not found" });
  if (!db.prepare("SELECT 1 FROM story_views WHERE story_id=? AND user_id=?").get(story.id, req.user.id)) {
    db.prepare("INSERT INTO story_views (story_id,user_id) VALUES (?,?)").run(story.id, req.user.id);
    db.prepare("UPDATE stories SET views_count=views_count+1 WHERE id=?").run(story.id);
  }
  res.json({ ok: true });
});

storiesRouter.post("/:id/react", auth, (req, res) => {
  const emoji = req.body.emoji || "❤️";
  db.prepare("INSERT OR REPLACE INTO story_reactions (story_id,user_id,emoji,created_at) VALUES (?,?,?,datetime('now'))").run(req.params.id, req.user.id, emoji);
  res.json({ ok: true });
});

storiesRouter.get("/:id/viewers", auth, (req, res) => {
  const story = db.prepare("SELECT * FROM stories WHERE id=?").get(req.params.id);
  if (!story || story.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  const viewers = db.prepare(`SELECT u.id,u.username,u.name,u.avatar,sv.viewed_at FROM users u INNER JOIN story_views sv ON sv.user_id=u.id WHERE sv.story_id=? ORDER BY sv.viewed_at DESC LIMIT 100`).all(story.id);
  res.json({ viewers });
});

storiesRouter.delete("/:id", auth, (req, res) => {
  const s = db.prepare("SELECT * FROM stories WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  db.prepare("DELETE FROM stories WHERE id=?").run(s.id);
  res.json({ ok: true });
});

// Highlights
storiesRouter.get("/highlights/:userId", (req, res) => {
  const h = db.prepare("SELECT * FROM highlights WHERE user_id=? ORDER BY position ASC").all(req.params.userId);
  const result = h.map(hi => {
    const stories = db.prepare(`SELECT s.* FROM stories s INNER JOIN highlight_stories hs ON hs.story_id=s.id WHERE hs.highlight_id=? ORDER BY hs.added_at ASC`).all(hi.id);
    return { ...hi, stories_count: stories.length, preview_url: stories[0]?.media_url || hi.cover_url };
  });
  res.json({ highlights: result });
});

storiesRouter.post("/highlights", auth, (req, res) => {
  const id = uuidv4();
  db.prepare("INSERT INTO highlights (id,user_id,name,cover_url) VALUES (?,?,?,?)").run(id, req.user.id, req.body.name||"New", req.body.cover_url||"");
  const storyIds = req.body.story_ids || [];
  storyIds.forEach(sid => db.prepare("INSERT OR IGNORE INTO highlight_stories (highlight_id,story_id) VALUES (?,?)").run(id, sid));
  res.status(201).json({ highlight: db.prepare("SELECT * FROM highlights WHERE id=?").get(id) });
});

storiesRouter.delete("/highlights/:id", auth, (req, res) => {
  const h = db.prepare("SELECT * FROM highlights WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!h) return res.status(404).json({ error: "Not found" });
  db.prepare("DELETE FROM highlights WHERE id=?").run(h.id);
  res.json({ ok: true });
});

module.exports.storiesRouter = storiesRouter;

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
const messagesRouter = require("express").Router();

messagesRouter.get("/conversations", auth, (req, res) => {
  const convs = db.prepare(`
    SELECT c.*, cm.last_read_at, cm.is_muted,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id!=? AND m.created_at>cm.last_read_at AND m.is_deleted=0) as unread_count
    FROM conversations c INNER JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=?
    ORDER BY c.updated_at DESC LIMIT 50
  `).all(req.user.id, req.user.id);

  const result = convs.map(c => {
    const members = db.prepare(`SELECT u.id,u.username,u.name,u.avatar,u.is_verified FROM users u INNER JOIN conversation_members cm ON cm.user_id=u.id WHERE cm.conversation_id=? AND u.id!=?`).all(c.id, req.user.id);
    const lastMsg = c.last_message_id ? db.prepare("SELECT * FROM messages WHERE id=?").get(c.last_message_id) : db.prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 1").get(c.id);
    return { id: c.id, type: c.type, name: c.type==="group"?c.name:(members[0]?.username||""), avatar: c.type==="group"?c.avatar:(members[0]?.avatar||""), members, last_message: lastMsg, unread_count: c.unread_count||0, is_muted: !!c.is_muted, updated_at: c.updated_at };
  });
  res.json({ conversations: result });
});

messagesRouter.post("/conversations", auth, (req, res) => {
  const { user_id, user_ids, type="dm", name="" } = req.body;

  if (type === "group" && user_ids?.length > 1) {
    const cid = uuidv4();
    db.prepare("INSERT INTO conversations (id,type,name,created_by) VALUES (?,?,?,?)").run(cid, "group", name||"Group", req.user.id);
    const allMembers = [req.user.id, ...user_ids.slice(0, 50)];
    allMembers.forEach(uid => db.prepare("INSERT OR IGNORE INTO conversation_members (conversation_id,user_id,role) VALUES (?,?,?)").run(cid, uid, uid === req.user.id ? "admin" : "member"));
    return res.status(201).json({ conversation_id: cid });
  }

  // DM — find or create
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  const existing = db.prepare(`
    SELECT c.id FROM conversations c
    INNER JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=?
    INNER JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=?
    WHERE c.type='dm' LIMIT 1
  `).get(req.user.id, user_id);
  if (existing) return res.json({ conversation_id: existing.id });
  const cid = uuidv4();
  db.prepare("INSERT INTO conversations (id,type) VALUES (?,?)").run(cid, "dm");
  db.prepare("INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)").run(cid, req.user.id);
  db.prepare("INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)").run(cid, user_id);
  res.status(201).json({ conversation_id: cid });
});

messagesRouter.get("/conversations/:id/messages", auth, (req, res) => {
  const member = db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: "Forbidden" });
  const { page, limit, offset } = paginate(req, 30, 50);
  const messages = db.prepare(`
    SELECT m.*, u.username, u.avatar, u.name
    FROM messages m INNER JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=? AND m.is_deleted=0
    ORDER BY m.created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM messages WHERE conversation_id=? AND is_deleted=0").get(req.params.id).c;
  db.prepare("UPDATE conversation_members SET last_read_at=datetime('now') WHERE conversation_id=? AND user_id=?").run(req.params.id, req.user.id);
  res.json(paginateResp(messages.reverse(), total, page, limit));
});

messagesRouter.delete("/messages/:id", auth, (req, res) => {
  const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(req.params.id);
  if (!msg || msg.sender_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  db.prepare("UPDATE messages SET is_deleted=1, text=NULL WHERE id=?").run(msg.id);
  res.json({ ok: true });
});

messagesRouter.post("/messages/:id/react", auth, (req, res) => {
  const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(req.params.id);
  if (!msg) return res.status(404).json({ error: "Not found" });
  let reactions = {};
  try { reactions = JSON.parse(msg.reactions || "{}"); } catch {}
  const emoji = req.body.emoji || "❤️";
  if (!reactions[emoji]) reactions[emoji] = [];
  const idx = reactions[emoji].indexOf(req.user.id);
  if (idx >= 0) reactions[emoji].splice(idx, 1);
  else reactions[emoji].push(req.user.id);
  if (!reactions[emoji].length) delete reactions[emoji];
  db.prepare("UPDATE messages SET reactions=? WHERE id=?").run(JSON.stringify(reactions), msg.id);
  res.json({ reactions });
});

module.exports.messagesRouter = messagesRouter;

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
const notifsRouter = require("express").Router();

notifsRouter.get("/", auth, (req, res) => {
  const { page, limit, offset } = paginate(req, 20, 50);
  const notifs = db.prepare(`
    SELECT n.*, u.username, u.avatar, u.name, u.is_verified
    FROM notifications n INNER JOIN users u ON u.id=n.actor_id
    WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id=?").get(req.user.id).c;
  const unread = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0").get(req.user.id).c;
  res.json({ ...paginateResp(notifs.map(n => ({ id: n.id, type: n.type, entity_id: n.entity_id, entity_type: n.entity_type, data: (() => { try { return JSON.parse(n.data); } catch { return {}; } })(), is_read: !!n.is_read, created_at: n.created_at, actor: { id: n.actor_id, username: n.username, name: n.name, avatar: n.avatar||`https://i.pravatar.cc/150?u=${n.actor_id}`, is_verified: !!n.is_verified } })), total, page, limit), unread });
});

notifsRouter.post("/read-all", auth, (req, res) => {
  db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=?").run(req.user.id);
  res.json({ ok: true });
});

notifsRouter.post("/:id/read", auth, (req, res) => {
  db.prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?").run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports.notifsRouter = notifsRouter;

// ─── SEARCH ───────────────────────────────────────────────────────────────────
const searchRouter = require("express").Router();

searchRouter.get("/", optionalAuth, (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json({ users: [], posts: [], hashtags: [], recent: [] });

  const users = db.prepare("SELECT * FROM users WHERE (username LIKE ? OR name LIKE ?) AND is_banned=0 LIMIT 8").all(`%${q}%`, `%${q}%`);
  const hashtags = db.prepare("SELECT * FROM hashtags WHERE name LIKE ? ORDER BY posts_count DESC LIMIT 8").all(`%${q}%`);
  const { postView } = require("../utils/helpers");
  const posts = db.prepare("SELECT * FROM posts WHERE caption LIKE ? AND is_archived=0 AND is_draft=0 LIMIT 6").all(`%${q}%`);

  // Save search history
  if (req.user) {
    const { v4: id } = require("uuid");
    db.prepare("INSERT INTO search_history (id,user_id,query) VALUES (?,?,?)").run(uuidv4(), req.user.id, q);
    // Keep only last 20
    const old = db.prepare("SELECT id FROM search_history WHERE user_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 20").all(req.user.id);
    old.forEach(o => db.prepare("DELETE FROM search_history WHERE id=?").run(o.id));
  }

  res.json({ users: users.map(u => ({ id:u.id,username:u.username,name:u.name,avatar:u.avatar||`https://i.pravatar.cc/150?u=${u.id}`,followers_count:u.followers_count })), hashtags, posts: posts.map(p => postView(p, req.user?.id)) });
});

searchRouter.get("/history", auth, (req, res) => {
  const history = db.prepare("SELECT * FROM search_history WHERE user_id=? ORDER BY created_at DESC LIMIT 20").all(req.user.id);
  res.json({ history });
});

searchRouter.delete("/history", auth, (req, res) => {
  db.prepare("DELETE FROM search_history WHERE user_id=?").run(req.user.id);
  res.json({ ok: true });
});

searchRouter.get("/trending", (req, res) => {
  const { updateHashtagTrends } = require("../utils/algorithm");
  updateHashtagTrends();
  const hashtags = db.prepare("SELECT * FROM hashtags ORDER BY trend_score DESC LIMIT 20").all();
  res.json({ hashtags });
});

module.exports.searchRouter = searchRouter;

// ─── ADMIN ────────────────────────────────────────────────────────────────────
const adminRouter = require("express").Router();
const { adminOnly } = require("../middleware/auth");
adminRouter.use(auth, adminOnly);

adminRouter.get("/stats", (req, res) => {
  const stats = {
    users: db.prepare("SELECT COUNT(*) as c FROM users WHERE is_banned=0").get().c,
    posts: db.prepare("SELECT COUNT(*) as c FROM posts WHERE is_archived=0").get().c,
    stories: db.prepare("SELECT COUNT(*) as c FROM stories WHERE expires_at > datetime('now')").get().c,
    reports: db.prepare("SELECT COUNT(*) as c FROM reports WHERE status='pending'").get().c,
    dau: db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM post_views WHERE viewed_at > datetime('now','-24 hours')").get().c,
    new_users_today: db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now','-24 hours')").get().c,
    new_posts_today: db.prepare("SELECT COUNT(*) as c FROM posts WHERE created_at > datetime('now','-24 hours')").get().c,
    messages_today: db.prepare("SELECT COUNT(*) as c FROM messages WHERE created_at > datetime('now','-24 hours')").get().c,
  };
  res.json({ stats });
});

adminRouter.get("/users", (req, res) => {
  const { limit, offset } = paginate(req, 20, 100);
  const q = req.query.q ? `%${req.query.q}%` : "%";
  const users = db.prepare("SELECT id,username,name,email,is_verified,is_banned,is_admin,created_at,followers_count,posts_count FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(q, q, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  res.json(paginateResp(users, total, parseInt(req.query.page)||1, limit));
});

adminRouter.post("/users/:id/ban", (req, res) => {
  const { reason="" } = req.body;
  db.prepare("UPDATE users SET is_banned=1, ban_reason=? WHERE id=?").run(reason, req.params.id);
  db.prepare("DELETE FROM refresh_tokens WHERE user_id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_log (id,admin_id,action,entity_id,entity_type,data) VALUES (?,?,?,?,?,?)").run(uuidv4(), req.user.id, "ban_user", req.params.id, "user", JSON.stringify({ reason }));
  res.json({ ok: true });
});

adminRouter.post("/users/:id/unban", (req, res) => {
  db.prepare("UPDATE users SET is_banned=0, ban_reason='' WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_log (id,admin_id,action,entity_id,entity_type) VALUES (?,?,?,?,?)").run(uuidv4(), req.user.id, "unban_user", req.params.id, "user");
  res.json({ ok: true });
});

adminRouter.post("/users/:id/verify", (req, res) => {
  db.prepare("UPDATE users SET is_verified=1 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

adminRouter.get("/reports", (req, res) => {
  const { limit, offset } = paginate(req, 20, 50);
  const status = req.query.status || "pending";
  const reports = db.prepare(`
    SELECT r.*, u.username as reporter_username FROM reports r
    INNER JOIN users u ON u.id=r.reporter_id
    WHERE r.status=? ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `).all(status, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status=?").get(status).c;
  res.json(paginateResp(reports, total, parseInt(req.query.page)||1, limit));
});

adminRouter.post("/reports/:id/resolve", (req, res) => {
  db.prepare("UPDATE reports SET status=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?").run(req.body.action||"resolved", req.user.id, req.params.id);
  if (req.body.action === "remove" && req.body.entity_type === "post") {
    const report = db.prepare("SELECT * FROM reports WHERE id=?").get(req.params.id);
    if (report) db.prepare("DELETE FROM posts WHERE id=?").run(report.entity_id);
  }
  res.json({ ok: true });
});

adminRouter.get("/posts", (req, res) => {
  const { limit, offset } = paginate(req, 20, 50);
  const posts = db.prepare("SELECT p.*,u.username FROM posts p INNER JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM posts").get().c;
  res.json(paginateResp(posts, total, parseInt(req.query.page)||1, limit));
});

adminRouter.delete("/posts/:id", (req, res) => {
  db.prepare("DELETE FROM posts WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_log (id,admin_id,action,entity_id,entity_type) VALUES (?,?,?,?,?)").run(uuidv4(), req.user.id, "delete_post", req.params.id, "post");
  res.json({ ok: true });
});

adminRouter.get("/audit-log", (req, res) => {
  const { limit, offset } = paginate(req, 20, 50);
  const logs = db.prepare(`SELECT al.*,u.username FROM audit_log al INNER JOIN users u ON u.id=al.admin_id ORDER BY al.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  res.json({ logs });
});

module.exports.adminRouter = adminRouter;

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
const analyticsRouter = require("express").Router();

analyticsRouter.get("/overview", auth, (req, res) => {
  const uid = req.user.id;
  const posts = db.prepare("SELECT id,likes_count,comments_count,saves_count,views_count,created_at FROM posts WHERE user_id=? AND is_archived=0 ORDER BY created_at DESC LIMIT 30").all(uid);
  const totalLikes    = posts.reduce((s,p) => s + p.likes_count, 0);
  const totalComments = posts.reduce((s,p) => s + p.comments_count, 0);
  const totalViews    = posts.reduce((s,p) => s + p.views_count, 0);
  const totalSaves    = posts.reduce((s,p) => s + p.saves_count, 0);
  const user = db.prepare("SELECT followers_count,following_count,posts_count FROM users WHERE id=?").get(uid);
  const newFollowers7d = db.prepare(`SELECT COUNT(*) as c FROM follows WHERE following_id=? AND created_at > datetime('now','-7 days')`).get(uid).c;
  const engagementRate = user.followers_count > 0 ? ((totalLikes + totalComments) / (posts.length || 1) / user.followers_count * 100).toFixed(2) : 0;

  const topPosts = [...posts].sort((a,b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count)).slice(0, 5);
  const weeklyData = Array.from({length:7}, (_,i) => {
    const d = new Date(Date.now() - (6-i) * 86400000).toISOString().split("T")[0];
    const dayLikes = db.prepare(`SELECT COUNT(*) as c FROM likes l INNER JOIN posts p ON p.id=l.post_id WHERE p.user_id=? AND date(l.created_at)=?`).get(uid, d).c;
    const dayFollowers = db.prepare(`SELECT COUNT(*) as c FROM follows WHERE following_id=? AND date(created_at)=?`).get(uid, d).c;
    return { date: d, likes: dayLikes, followers: dayFollowers };
  });

  res.json({ followers: user.followers_count, following: user.following_count, posts: user.posts_count, total_likes: totalLikes, total_comments: totalComments, total_views: totalViews, total_saves: totalSaves, engagement_rate: parseFloat(engagementRate), new_followers_7d: newFollowers7d, top_posts: topPosts, weekly: weeklyData });
});

analyticsRouter.get("/posts", auth, (req, res) => {
  const { page, limit, offset } = paginate(req, 10, 20);
  const posts = db.prepare("SELECT * FROM posts WHERE user_id=? AND is_archived=0 ORDER BY likes_count DESC LIMIT ? OFFSET ?").all(req.user.id, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM posts WHERE user_id=? AND is_archived=0").get(req.user.id).c;
  res.json(paginateResp(posts, total, page, limit));
});

module.exports.analyticsRouter = analyticsRouter;

// ─── EXPLORE ──────────────────────────────────────────────────────────────────
const exploreRouter = require("express").Router();
const { updateHashtagTrends } = require("../utils/algorithm");

exploreRouter.get("/trending", (req, res) => {
  updateHashtagTrends();
  const hashtags = db.prepare("SELECT * FROM hashtags ORDER BY trend_score DESC LIMIT 20").all();
  const { postView } = require("../utils/helpers");
  const recentPosts = db.prepare("SELECT * FROM posts WHERE is_archived=0 AND is_draft=0 ORDER BY engagement_score DESC LIMIT 9").all();
  res.json({ hashtags, featured_posts: recentPosts.map(p => postView(p, null)) });
});

exploreRouter.get("/hashtag/:tag", optionalAuth, (req, res) => {
  const tag = req.params.tag.toLowerCase();
  const { postView } = require("../utils/helpers");
  const posts = db.prepare(`SELECT p.* FROM posts p INNER JOIN post_tags t ON t.post_id=p.id WHERE t.tag=? AND p.is_archived=0 ORDER BY p.likes_count DESC LIMIT 30`).all(tag);
  const hashtag = db.prepare("SELECT * FROM hashtags WHERE name=?").get(tag);
  res.json({ tag, hashtag, posts: posts.map(p => postView(p, req.user?.id)) });
});

exploreRouter.get("/reels", optionalAuth, (req, res) => {
  const { page, limit, offset } = paginate(req, 10, 20);
  const posts = db.prepare(`
    SELECT p.*,u.username,u.avatar,u.name,u.is_verified FROM posts p
    INNER JOIN users u ON u.id=p.user_id
    WHERE p.is_archived=0 AND p.is_draft=0
    ORDER BY p.likes_count DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  res.json({ reels: posts });
});

module.exports.exploreRouter = exploreRouter;
