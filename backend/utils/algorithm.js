/**
 * Yor Talks Feed Ranking Algorithm
 * Scores posts using a weighted combination of signals:
 *  - Recency (exponential decay)
 *  - Engagement rate (likes + comments + saves / followers)
 *  - Relationship strength (do you interact with this person often?)
 *  - Content diversity (avoid repeating same user)
 */

const db = require("../db");

// Recency decay: half-life of 6 hours for followed, 12 for explore
const decayScore = (createdAt, halfLifeHours = 6) => {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  return Math.pow(0.5, ageHours / halfLifeHours);
};

// Relationship strength: how often the viewer has liked/commented on this author
const relationshipScore = (viewerId, authorId) => {
  if (!viewerId || viewerId === authorId) return 0;
  const recentLikes = db.prepare(`
    SELECT COUNT(*) as c FROM likes l
    INNER JOIN posts p ON p.id = l.post_id
    WHERE l.user_id = ? AND p.user_id = ?
    AND l.created_at > datetime('now', '-30 days')
  `).get(viewerId, authorId)?.c || 0;

  const recentComments = db.prepare(`
    SELECT COUNT(*) as c FROM comments c
    INNER JOIN posts p ON p.id = c.post_id
    WHERE c.user_id = ? AND p.user_id = ?
    AND c.created_at > datetime('now', '-30 days')
  `).get(viewerId, authorId)?.c || 0;

  return Math.min(1, (recentLikes * 0.03) + (recentComments * 0.07));
};

const rankPost = (post, viewerId) => {
  const author = db.prepare("SELECT followers_count FROM users WHERE id=?").get(post.user_id);
  const followerCount = Math.max(1, author?.followers_count || 1);

  // Engagement rate (normalized)
  const engagementRate = (
    (post.likes_count * 1.0) +
    (post.comments_count * 2.0) +
    (post.saves_count * 3.0)
  ) / followerCount;
  const engagementScore = Math.log1p(engagementRate) / 5;

  // Recency
  const recency = decayScore(post.created_at, 8);

  // Relationship
  const relationship = viewerId ? relationshipScore(viewerId, post.user_id) : 0;

  // Novelty: penalize if viewer already saw this post
  const alreadySeen = viewerId
    ? !!db.prepare("SELECT 1 FROM post_views WHERE user_id=? AND post_id=?").get(viewerId, post.id)
    : false;
  const noveltyMult = alreadySeen ? 0.2 : 1.0;

  const score = (
    recency       * 0.35 +
    engagementScore * 0.30 +
    relationship  * 0.25 +
    Math.random() * 0.10  // exploration noise
  ) * noveltyMult;

  return score;
};

const rankFeed = (posts, viewerId) => {
  // Score all posts
  const scored = posts.map(p => ({ ...p, _score: rankPost(p, viewerId) }));

  // Sort by score desc
  scored.sort((a, b) => b._score - a._score);

  // Diversity: max 2 consecutive posts from same user
  const result = [];
  const recentAuthors = [];
  for (const post of scored) {
    const lastTwo = recentAuthors.slice(-2);
    if (lastTwo.every(id => id === post.user_id) && result.length > 3) {
      // push to later in list
      result.splice(result.length - 1, 0, post);
    } else {
      result.push(post);
    }
    recentAuthors.push(post.user_id);
  }

  return result.map(({ _score, ...p }) => p);
};

// Update engagement_score for a post (call after each interaction)
const updateEngagementScore = (postId) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(postId);
  if (!post) return;
  const author = db.prepare("SELECT followers_count FROM users WHERE id=?").get(post.user_id);
  const fc = Math.max(1, author?.followers_count || 1);
  const score = (post.likes_count + post.comments_count * 2 + post.saves_count * 3) / fc;
  db.prepare("UPDATE posts SET engagement_score=? WHERE id=?").run(score, postId);
};

// Trending score for hashtags (weighted by post age)
const updateHashtagTrends = () => {
  const tags = db.prepare("SELECT name FROM hashtags").all();
  tags.forEach(({ name }) => {
    const recentCount = db.prepare(`
      SELECT COUNT(*) as c FROM post_tags pt
      INNER JOIN posts p ON p.id = pt.post_id
      WHERE pt.tag = ? AND p.created_at > datetime('now', '-48 hours')
    `).get(name)?.c || 0;
    const score = Math.log1p(recentCount);
    db.prepare("UPDATE hashtags SET trend_score=? WHERE name=?").run(score, name);
  });
};

module.exports = { rankFeed, rankPost, updateEngagementScore, updateHashtagTrends };
