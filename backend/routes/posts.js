const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { auth, optionalAuth } = require("../middleware/auth");
const { upload, processPostMedia } = require("../middleware/upload");
const { postView, paginate, paginateResp, pushNotif, extractTags, extractMentions, upsertHashtags } = require("../utils/helpers");
const { rankFeed, updateEngagementScore } = require("../utils/algorithm");
const cache = require("../utils/cache");

// ── GET /api/posts/feed ───────────────────────────────────────────────────────
router.get("/feed", auth, (req, res) => {
  const { page, limit, offset } = paginate(req, 10, 20);
  const cacheKey = `feed:${req.user.id}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  // Fetch candidate posts from follows (3x overfetch for ranking)
  const candidates = db.prepare(`
    SELECT p.* FROM posts p
    INNER JOIN follows f ON f.following_id = p.user_id
    WHERE f.follower_id = ? AND p.is_archived = 0 AND p.is_draft = 0
    AND (p.scheduled_at IS NULL OR p.scheduled_at <= datetime('now'))
    AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, req.user.id, limit * 3, offset);

  const ranked = rankFeed(candidates, req.user.id).slice(0, limit);
  const total = db.prepare(`
    SELECT COUNT(*) as c FROM posts p
    INNER JOIN follows f ON f.following_id = p.user_id
    WHERE f.follower_id = ? AND p.is_archived = 0 AND p.is_draft = 0
  `).get(req.user.id).c;

  const result = paginateResp(ranked.map(p => postView(p, req.user.id)), total, page, limit);
  cache.set(cacheKey, result, 60); // 1 min cache
  res.json(result);
});

// ── GET /api/posts/explore ────────────────────────────────────────────────────
router.get("/explore", optionalAuth, (req, res) => {
  const { page, limit, offset } = paginate(req, 15, 30);
  const blockList = req.user
    ? db.prepare("SELECT blocked_id FROM blocks WHERE blocker_id=?").all(req.user.id).map(r => r.blocked_id)
    : [];
  const placeholders = blockList.length ? `AND p.user_id NOT IN (${blockList.map(() => "?").join(",")})` : "";

  const posts = db.prepare(`
    SELECT p.* FROM posts p
    WHERE p.is_archived=0 AND p.is_draft=0 AND p.visibility='public' ${placeholders}
    ORDER BY p.engagement_score DESC, p.created_at DESC LIMIT ? OFFSET ?
  `).all(...blockList, limit, offset);

  const total = db.prepare("SELECT COUNT(*) as c FROM posts WHERE is_archived=0 AND is_draft=0 AND visibility='public'").get().c;
  res.json(paginateResp(posts.map(p => postView(p, req.user?.id)), total, page, limit));
});

// ── GET /api/posts/saved ──────────────────────────────────────────────────────
router.get("/saved", auth, (req, res) => {
  const { page, limit, offset } = paginate(req, 12, 30);
  const posts = db.prepare(`
    SELECT p.* FROM posts p INNER JOIN saves s ON s.post_id=p.id
    WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM saves WHERE user_id=?").get(req.user.id).c;
  res.json(paginateResp(posts.map(p => postView(p, req.user.id)), total, page, limit));
});

// ── GET /api/posts/archived ───────────────────────────────────────────────────
router.get("/archived", auth, (req, res) => {
  const { page, limit, offset } = paginate(req, 12, 30);
  const posts = db.prepare("SELECT * FROM posts WHERE user_id=? AND is_archived=1 ORDER BY created_at DESC LIMIT ? OFFSET ?").all(req.user.id, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM posts WHERE user_id=? AND is_archived=1").get(req.user.id).c;
  res.json(paginateResp(posts.map(p => postView(p, req.user.id)), total, page, limit));
});

// ── POST /api/posts ───────────────────────────────────────────────────────────
router.post("/", auth, upload.multiple("media", 10), processPostMedia, [
  body("caption").optional().isLength({max:2200}),
  body("location").optional().isLength({max:100}),
  body("visibility").optional().isIn(["public","followers","close_friends","private"]),
], (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(422).json({ errors: validationResult(req).array() });

  const media = req.processedMedia || [];
  const imageUrl = req.body.image_url;
  if (!media.length && !imageUrl) return res.status(400).json({ error: "At least one image or video required" });

  const id = uuidv4();
  const { caption="", location="", visibility="public", is_draft="0" } = req.body;

  db.prepare(`INSERT INTO posts (id,user_id,caption,location,visibility,is_draft) VALUES (?,?,?,?,?,?)`)
    .run(id, req.user.id, caption, location, visibility, parseInt(is_draft)||0);

  // Store media
  const mediaList = media.length ? media : [{ url: imageUrl, type: "image", width: 0, height: 0 }];
  mediaList.forEach((m, i) => {
    db.prepare("INSERT INTO post_media (id,post_id,url,type,width,height,position) VALUES (?,?,?,?,?,?,?)")
      .run(uuidv4(), id, m.url, m.type, m.width||0, m.height||0, i);
  });

  if (!parseInt(is_draft)) {
    db.prepare("UPDATE users SET posts_count=posts_count+1 WHERE id=?").run(req.user.id);

    // Tags & hashtags
    const tags = extractTags(caption);
    tags.forEach(t => db.prepare("INSERT OR IGNORE INTO post_tags (post_id,tag) VALUES (?,?)").run(id, t));
    upsertHashtags(tags);

    // Mentions → notifications
    const mentions = extractMentions(caption);
    mentions.forEach(username => {
      const u = db.prepare("SELECT id FROM users WHERE username=?").get(username);
      if (u) pushNotif(u.id, req.user.id, "mention", id, "post");
    });

    // Initialize analytics row
    db.prepare("INSERT INTO post_analytics (id,post_id) VALUES (?,?)").run(uuidv4(), id);
    cache.delPattern(`feed:*`);
  }

  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(id);
  res.status(201).json({ post: postView(post, req.user.id) });
});

// ── GET /api/posts/:id ────────────────────────────────────────────────────────
router.get("/:id", optionalAuth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post || post.is_archived) return res.status(404).json({ error: "Post not found" });
  // Track view
  if (req.user && req.user.id !== post.user_id) {
    const seen = db.prepare("SELECT 1 FROM post_views WHERE user_id=? AND post_id=?").get(req.user.id, post.id);
    if (!seen) {
      db.prepare("INSERT INTO post_views (user_id,post_id) VALUES (?,?)").run(req.user.id, post.id);
      db.prepare("UPDATE posts SET views_count=views_count+1 WHERE id=?").run(post.id);
    }
  }
  res.json({ post: postView(post, req.user?.id) });
});

// ── PATCH /api/posts/:id ──────────────────────────────────────────────────────
router.patch("/:id", auth, [
  body("caption").optional().isLength({max:2200}),
  body("location").optional().isLength({max:100}),
  body("visibility").optional().isIn(["public","followers","close_friends","private"]),
], (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  const allowed = ["caption","location","visibility"];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });

  const sets = Object.keys(updates).map(k => `${k}=@${k}`).join(", ");
  db.prepare(`UPDATE posts SET ${sets}, updated_at=datetime('now') WHERE id=@id`).run({ ...updates, id: post.id });

  // Re-process tags if caption changed
  if (updates.caption) {
    db.prepare("DELETE FROM post_tags WHERE post_id=?").run(post.id);
    const tags = extractTags(updates.caption);
    tags.forEach(t => db.prepare("INSERT OR IGNORE INTO post_tags (post_id,tag) VALUES (?,?)").run(post.id, t));
  }
  cache.delPattern(`feed:*`);
  res.json({ post: postView(db.prepare("SELECT * FROM posts WHERE id=?").get(post.id), req.user.id) });
});

// ── DELETE /api/posts/:id ─────────────────────────────────────────────────────
router.delete("/:id", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (post.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "Forbidden" });
  db.prepare("DELETE FROM posts WHERE id=?").run(post.id);
  db.prepare("UPDATE users SET posts_count=MAX(0,posts_count-1) WHERE id=?").run(post.user_id);
  cache.delPattern(`feed:*`);
  res.json({ ok: true });
});

// ── POST /api/posts/:id/archive ───────────────────────────────────────────────
router.post("/:id/archive", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!post) return res.status(404).json({ error: "Not found" });
  const newVal = post.is_archived ? 0 : 1;
  db.prepare("UPDATE posts SET is_archived=? WHERE id=?").run(newVal, post.id);
  if (newVal) db.prepare("UPDATE users SET posts_count=MAX(0,posts_count-1) WHERE id=?").run(req.user.id);
  else db.prepare("UPDATE users SET posts_count=posts_count+1 WHERE id=?").run(req.user.id);
  res.json({ is_archived: !!newVal });
});

// ── POST /api/posts/:id/like ──────────────────────────────────────────────────
router.post("/:id/like", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });

  const existed = db.prepare("SELECT 1 FROM likes WHERE user_id=? AND post_id=?").get(req.user.id, post.id);
  if (existed) {
    db.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").run(req.user.id, post.id);
    db.prepare("UPDATE posts SET likes_count=MAX(0,likes_count-1) WHERE id=?").run(post.id);
    updateEngagementScore(post.id);
    return res.json({ is_liked: false, likes_count: db.prepare("SELECT likes_count FROM posts WHERE id=?").get(post.id).likes_count });
  }

  db.prepare("INSERT INTO likes (user_id,post_id) VALUES (?,?)").run(req.user.id, post.id);
  db.prepare("UPDATE posts SET likes_count=likes_count+1 WHERE id=?").run(post.id);
  updateEngagementScore(post.id);
  pushNotif(post.user_id, req.user.id, "like", post.id, "post");
  cache.delPattern(`feed:${post.user_id}:*`);

  res.json({ is_liked: true, likes_count: db.prepare("SELECT likes_count FROM posts WHERE id=?").get(post.id).likes_count });
});

// ── POST /api/posts/:id/save ──────────────────────────────────────────────────
router.post("/:id/save", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });

  const existed = db.prepare("SELECT 1 FROM saves WHERE user_id=? AND post_id=?").get(req.user.id, post.id);
  if (existed) {
    db.prepare("DELETE FROM saves WHERE user_id=? AND post_id=?").run(req.user.id, post.id);
    db.prepare("UPDATE posts SET saves_count=MAX(0,saves_count-1) WHERE id=?").run(post.id);
    updateEngagementScore(post.id);
    return res.json({ is_saved: false });
  }

  const collectionId = req.body.collection_id || null;
  db.prepare("INSERT INTO saves (user_id,post_id,collection_id) VALUES (?,?,?)").run(req.user.id, post.id, collectionId);
  db.prepare("UPDATE posts SET saves_count=saves_count+1 WHERE id=?").run(post.id);
  updateEngagementScore(post.id);
  pushNotif(post.user_id, req.user.id, "save", post.id, "post");
  res.json({ is_saved: true });
});

// ── GET /api/posts/:id/comments ───────────────────────────────────────────────
router.get("/:id/comments", optionalAuth, (req, res) => {
  const { page, limit, offset } = paginate(req, 20, 50);
  const comments = db.prepare(`
    SELECT c.*, u.username, u.avatar, u.name, u.is_verified
    FROM comments c INNER JOIN users u ON u.id=c.user_id
    WHERE c.post_id=? AND c.parent_id IS NULL
    ORDER BY c.is_pinned DESC, c.created_at ASC LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);

  const total = db.prepare("SELECT COUNT(*) as c FROM comments WHERE post_id=? AND parent_id IS NULL").get(req.params.id).c;

  const result = comments.map(c => {
    const isLiked = req.user ? !!db.prepare("SELECT 1 FROM comment_likes WHERE user_id=? AND comment_id=?").get(req.user.id, c.id) : false;
    const replies = db.prepare(`
      SELECT cm.*, u.username, u.avatar, u.name FROM comments cm
      INNER JOIN users u ON u.id=cm.user_id WHERE cm.parent_id=? ORDER BY cm.created_at ASC LIMIT 3
    `).all(c.id);
    return {
      id: c.id, text: c.text, likes_count: c.likes_count, created_at: c.created_at, is_pinned: !!c.is_pinned,
      user: { id: c.user_id, username: c.username, name: c.name, avatar: c.avatar || `https://i.pravatar.cc/150?u=${c.user_id}`, is_verified: !!c.is_verified },
      is_liked: isLiked, replies_count: c.replies_count,
      top_replies: replies.map(r => ({ id: r.id, text: r.text, created_at: r.created_at, user: { id: r.user_id, username: r.username, name: r.name, avatar: r.avatar || `https://i.pravatar.cc/150?u=${r.user_id}` } })),
    };
  });

  res.json(paginateResp(result, total, page, limit));
});

// ── POST /api/posts/:id/comments ──────────────────────────────────────────────
router.post("/:id/comments", auth, [body("text").trim().isLength({min:1,max:2200})], (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(422).json({ errors: validationResult(req).array() });

  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });

  const cid = uuidv4();
  const parentId = req.body.parent_id || null;
  db.prepare("INSERT INTO comments (id,post_id,user_id,parent_id,text) VALUES (?,?,?,?,?)").run(cid, post.id, req.user.id, parentId, req.body.text);
  db.prepare("UPDATE posts SET comments_count=comments_count+1 WHERE id=?").run(post.id);
  if (parentId) db.prepare("UPDATE comments SET replies_count=replies_count+1 WHERE id=?").run(parentId);

  updateEngagementScore(post.id);
  pushNotif(post.user_id, req.user.id, "comment", post.id, "post");
  cache.delPattern(`feed:*`);

  const comment = db.prepare("SELECT * FROM comments WHERE id=?").get(cid);
  res.status(201).json({
    comment: {
      ...comment,
      user: { id: req.user.id, username: req.user.username, name: req.user.name, avatar: req.user.avatar || `https://i.pravatar.cc/150?u=${req.user.id}` },
      is_liked: false, top_replies: [],
    }
  });
});

// ── POST /api/posts/:id/comments/:cid/like ────────────────────────────────────
router.post("/:id/comments/:cid/like", auth, (req, res) => {
  const comment = db.prepare("SELECT * FROM comments WHERE id=?").get(req.params.cid);
  if (!comment) return res.status(404).json({ error: "Not found" });
  const existed = db.prepare("SELECT 1 FROM comment_likes WHERE user_id=? AND comment_id=?").get(req.user.id, comment.id);
  if (existed) {
    db.prepare("DELETE FROM comment_likes WHERE user_id=? AND comment_id=?").run(req.user.id, comment.id);
    db.prepare("UPDATE comments SET likes_count=MAX(0,likes_count-1) WHERE id=?").run(comment.id);
    return res.json({ is_liked: false });
  }
  db.prepare("INSERT INTO comment_likes (user_id,comment_id) VALUES (?,?)").run(req.user.id, comment.id);
  db.prepare("UPDATE comments SET likes_count=likes_count+1 WHERE id=?").run(comment.id);
  res.json({ is_liked: true });
});

// ── DELETE /api/posts/:id/comments/:cid ──────────────────────────────────────
router.delete("/:id/comments/:cid", auth, (req, res) => {
  const comment = db.prepare("SELECT * FROM comments WHERE id=?").get(req.params.cid);
  if (!comment) return res.status(404).json({ error: "Not found" });
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (comment.user_id !== req.user.id && post?.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  db.prepare("DELETE FROM comments WHERE id=?").run(comment.id);
  db.prepare("UPDATE posts SET comments_count=MAX(0,comments_count-1) WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/posts/:id/pin-comment ──────────────────────────────────────────
router.post("/:id/pin-comment", auth, [body("comment_id").notEmpty()], (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post || post.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  db.prepare("UPDATE comments SET is_pinned=0 WHERE post_id=?").run(post.id);
  db.prepare("UPDATE comments SET is_pinned=1 WHERE id=? AND post_id=?").run(req.body.comment_id, post.id);
  res.json({ ok: true });
});

// ── POST /api/posts/:id/report ────────────────────────────────────────────────
router.post("/:id/report", auth, [body("reason").notEmpty()], (req, res) => {
  db.prepare("INSERT INTO reports (id,reporter_id,entity_id,entity_type,reason,details) VALUES (?,?,?,?,?,?)")
    .run(uuidv4(), req.user.id, req.params.id, "post", req.body.reason, req.body.details || "");
  res.json({ ok: true });
});

// ── GET /api/posts/:id/analytics ─────────────────────────────────────────────
router.get("/:id/analytics", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post || post.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  const analytics = db.prepare("SELECT * FROM post_analytics WHERE post_id=?").get(post.id);
  res.json({
    post_id: post.id,
    likes: post.likes_count, comments: post.comments_count, saves: post.saves_count,
    shares: post.shares_count, views: post.views_count,
    impressions: analytics?.impressions || post.views_count,
    engagement_rate: post.engagement_score,
    created_at: post.created_at,
  });
});

// ── GET /api/posts/:id/likes-list ─────────────────────────────────────────────
router.get("/:id/likes-list", optionalAuth, (req, res) => {
  const { limit, offset } = paginate(req, 20, 50);
  const likers = db.prepare(`
    SELECT u.id,u.username,u.name,u.avatar,u.is_verified FROM users u
    INNER JOIN likes l ON l.user_id=u.id
    WHERE l.post_id=? ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);
  res.json({ users: likers });
});

module.exports = router;
