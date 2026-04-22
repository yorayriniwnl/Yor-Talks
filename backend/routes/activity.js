const router = require("express").Router();
const db = require("../db");
const { auth } = require("../middleware/auth");
const { postView, userMini } = require("../utils/helpers");

// GET /api/activity - recent activity from followed users
router.get("/", auth, (req, res) => {
  const uid = req.user.id;

  // Recent likes from followed users (last 48h)
  const likes = db.prepare(`
    SELECT 'like' as type, u.id as actor_id, u.username, u.name, u.avatar, u.is_verified,
           p.id as post_id, p.image_url, l.created_at
    FROM likes l
    INNER JOIN users u ON u.id = l.user_id
    INNER JOIN posts p ON p.id = l.post_id
    INNER JOIN follows f ON f.following_id = l.user_id AND f.follower_id = ?
    WHERE l.created_at > datetime('now', '-48 hours')
    AND l.user_id != ?
    AND p.user_id != ?
    ORDER BY l.created_at DESC LIMIT 15
  `).all(uid, uid, uid);

  // Recent follows from followed users
  const follows = db.prepare(`
    SELECT 'follow' as type, u.id as actor_id, u.username, u.name, u.avatar, u.is_verified,
           u2.id as target_id, u2.username as target_username, u2.avatar as target_avatar,
           f.created_at
    FROM follows f
    INNER JOIN users u  ON u.id  = f.follower_id
    INNER JOIN users u2 ON u2.id = f.following_id
    INNER JOIN follows mf ON mf.following_id = f.follower_id AND mf.follower_id = ?
    WHERE f.created_at > datetime('now', '-48 hours')
    AND f.follower_id != ?
    ORDER BY f.created_at DESC LIMIT 10
  `).all(uid, uid);

  // Recent posts from followed users
  const posts = db.prepare(`
    SELECT 'post' as type, u.id as actor_id, u.username, u.name, u.avatar, u.is_verified,
           p.id as post_id, p.image_url, p.caption, p.likes_count, p.created_at
    FROM posts p
    INNER JOIN users u ON u.id = p.user_id
    INNER JOIN follows f ON f.following_id = p.user_id AND f.follower_id = ?
    WHERE p.created_at > datetime('now', '-48 hours')
    AND p.is_archived = 0 AND p.is_draft = 0
    ORDER BY p.created_at DESC LIMIT 10
  `).all(uid);

  // Merge and sort by created_at
  const all = [...likes, ...follows, ...posts]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 30);

  res.json({ activity: all });
});

// GET /api/activity/suggested-posts - ML-style post recommendations
router.get("/suggested", auth, (req, res) => {
  const uid = req.user.id;
  const limit = parseInt(req.query.limit) || 12;

  // Posts liked by people you follow that you haven't seen
  const suggested = db.prepare(`
    SELECT DISTINCT p.*, COUNT(l.user_id) as mutual_likes
    FROM posts p
    INNER JOIN likes l ON l.post_id = p.id
    INNER JOIN follows f ON f.following_id = l.user_id AND f.follower_id = ?
    WHERE p.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
    AND p.user_id != ?
    AND p.is_archived = 0 AND p.is_draft = 0
    AND p.id NOT IN (SELECT post_id FROM post_views WHERE user_id = ?)
    AND p.id NOT IN (SELECT post_id FROM likes WHERE user_id = ?)
    GROUP BY p.id
    ORDER BY mutual_likes DESC, p.engagement_score DESC
    LIMIT ?
  `).all(uid, uid, uid, uid, uid, limit);

  res.json({ posts: suggested.map(p => postView(p, uid)) });
});

module.exports = router;
