const db = require("../db");

// ── Post/User views ──────────────────────────────────────────────────────────
const userMini = (u) => ({
  id: u.id, username: u.username, name: u.name,
  avatar: u.avatar || `https://i.pravatar.cc/150?u=${u.id}`,
  is_verified: !!u.is_verified,
});

const postView = (p, viewerId) => {
  const media = db.prepare("SELECT * FROM post_media WHERE post_id=? ORDER BY position ASC").all(p.id);
  const tags  = db.prepare("SELECT tag FROM post_tags WHERE post_id=?").all(p.id).map(t => t.tag);
  const user  = db.prepare("SELECT id,username,name,avatar,is_verified FROM users WHERE id=?").get(p.user_id);

  const isLiked = viewerId ? !!db.prepare("SELECT 1 FROM likes WHERE user_id=? AND post_id=?").get(viewerId, p.id) : false;
  const isSaved = viewerId ? !!db.prepare("SELECT 1 FROM saves WHERE user_id=? AND post_id=?").get(viewerId, p.id) : false;
  const isFollowing = viewerId && viewerId !== p.user_id
    ? !!db.prepare("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?").get(viewerId, p.user_id)
    : false;

  return {
    id: p.id, caption: p.caption, location: p.location,
    visibility: p.visibility, is_archived: !!p.is_archived,
    likes_count: p.likes_count, comments_count: p.comments_count,
    saves_count: p.saves_count, shares_count: p.shares_count, views_count: p.views_count,
    engagement_score: p.engagement_score,
    tags, created_at: p.created_at, updated_at: p.updated_at,
    // Multi-image carousel support
    media: media.length ? media : (p.image_url ? [{ url: p.image_url, type: "image", position: 0 }] : []),
    image_url: media[0]?.url || p.image_url || null,
    media_count: media.length || (p.image_url ? 1 : 0),
    user: user ? { ...userMini(user), is_following: isFollowing } : null,
    is_liked: isLiked, is_saved: isSaved,
  };
};

// ── Pagination ───────────────────────────────────────────────────────────────
const paginate = (req, defaultLimit = 10, maxLimit = 30) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(maxLimit, parseInt(req.query.limit) || defaultLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const paginateResp = (items, total, page, limit) => ({
  items,
  meta: {
    page, limit, total,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  }
});

// ── Notification helpers ──────────────────────────────────────────────────────
const { v4: uuidv4 } = require("uuid");

const pushNotif = (userId, actorId, type, entityId = null, entityType = null, data = {}) => {
  if (userId === actorId) return;
  db.prepare(`
    INSERT INTO notifications (id,user_id,actor_id,type,entity_id,entity_type,data)
    VALUES (?,?,?,?,?,?,?)
  `).run(uuidv4(), userId, actorId, type, entityId, entityType, JSON.stringify(data));
};

// ── Tag extraction ────────────────────────────────────────────────────────────
const extractTags = (caption = "") =>
  [...new Set((caption.match(/#[\w]+/g) || []).map(t => t.slice(1).toLowerCase()))].slice(0, 30);

const extractMentions = (caption = "") =>
  [...new Set((caption.match(/@[\w.]+/g) || []).map(m => m.slice(1).toLowerCase()))];

// ── Upsert hashtags ───────────────────────────────────────────────────────────
const upsertHashtags = (tags) => {
  tags.forEach(tag => {
    db.prepare(`
      INSERT INTO hashtags (id, name, posts_count)
      VALUES (?, ?, 1)
      ON CONFLICT(name) DO UPDATE SET posts_count = posts_count + 1
    `).run(uuidv4(), tag);
  });
};

module.exports = { userMini, postView, paginate, paginateResp, pushNotif, extractTags, extractMentions, upsertHashtags };
