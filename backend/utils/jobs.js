/**
 * Background jobs — run on server startup
 * - Expire old stories (cleanup)
 * - Update hashtag trend scores every hour
 * - Clean up old search history
 * - Clean up expired password resets
 * - Compute daily analytics snapshot
 */

const db = require("../db");
const { v4: uuidv4 } = require("uuid");

const log = (msg) => console.log(`[JOBS ${new Date().toISOString().slice(11,19)}] ${msg}`);

// ── Clean expired stories ─────────────────────────────────────────────────────
function cleanExpiredStories() {
  const { changes } = db.prepare("DELETE FROM stories WHERE expires_at < datetime('now')").run();
  if (changes > 0) log(`Cleaned ${changes} expired stories`);
}

// ── Update hashtag trend scores ───────────────────────────────────────────────
function updateHashtagTrends() {
  const tags = db.prepare("SELECT name FROM hashtags").all();
  tags.forEach(({ name }) => {
    const r24h = db.prepare(`SELECT COUNT(*) as c FROM post_tags pt INNER JOIN posts p ON p.id=pt.post_id WHERE pt.tag=? AND p.created_at > datetime('now','-24 hours')`).get(name)?.c || 0;
    const r7d  = db.prepare(`SELECT COUNT(*) as c FROM post_tags pt INNER JOIN posts p ON p.id=pt.post_id WHERE pt.tag=? AND p.created_at > datetime('now','-7 days')`).get(name)?.c || 0;
    const score = Math.log1p(r24h * 3 + r7d);
    db.prepare("UPDATE hashtags SET trend_score=? WHERE name=?").run(score, name);
  });
  if (tags.length) log(`Updated trends for ${tags.length} hashtags`);
}

// ── Clean old search history ──────────────────────────────────────────────────
function cleanSearchHistory() {
  // Keep only last 30 entries per user
  const users = db.prepare("SELECT DISTINCT user_id FROM search_history").all();
  users.forEach(({ user_id }) => {
    const old = db.prepare("SELECT id FROM search_history WHERE user_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 30").all(user_id);
    old.forEach(({ id }) => db.prepare("DELETE FROM search_history WHERE id=?").run(id));
  });
}

// ── Clean expired password resets ─────────────────────────────────────────────
function cleanPasswordResets() {
  const { changes } = db.prepare("DELETE FROM password_resets WHERE expires_at < datetime('now') OR used=1").run();
  if (changes > 0) log(`Cleaned ${changes} expired password resets`);
}

// ── Daily analytics snapshot ──────────────────────────────────────────────────
function snapshotDailyAnalytics() {
  const today = new Date().toISOString().split("T")[0];
  const users = db.prepare("SELECT id FROM users WHERE is_banned=0").all();
  const stmt  = db.prepare(`
    INSERT OR REPLACE INTO user_analytics_daily (id, user_id, date, impressions, reach, profile_visits, new_followers)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  users.forEach(({ id }) => {
    const impressions    = db.prepare(`SELECT COUNT(*) as c FROM post_views pv INNER JOIN posts p ON p.id=pv.post_id WHERE p.user_id=? AND date(pv.viewed_at)=?`).get(id, today)?.c || 0;
    const new_followers  = db.prepare(`SELECT COUNT(*) as c FROM follows WHERE following_id=? AND date(created_at)=?`).get(id, today)?.c || 0;
    stmt.run(uuidv4(), id, today, impressions, Math.round(impressions * 0.7), 0, new_followers);
  });
  log(`Snapshotted analytics for ${users.length} users`);
}

// ── Compute engagement scores ─────────────────────────────────────────────────
function updateEngagementScores() {
  const posts = db.prepare("SELECT p.*, u.followers_count FROM posts p INNER JOIN users u ON u.id=p.user_id WHERE p.is_archived=0").all();
  const stmt  = db.prepare("UPDATE posts SET engagement_score=? WHERE id=?");
  posts.forEach(p => {
    const fc    = Math.max(1, p.followers_count || 1);
    const score = (p.likes_count + p.comments_count * 2 + p.saves_count * 3) / fc;
    stmt.run(score, p.id);
  });
}

// ── Schedule ──────────────────────────────────────────────────────────────────
function startJobs() {
  log("Background jobs started");

  // Run immediately on boot
  cleanExpiredStories();
  updateHashtagTrends();
  cleanPasswordResets();
  updateEngagementScores();

  // Every 5 minutes
  setInterval(cleanExpiredStories, 5 * 60 * 1000);

  // Every 30 minutes
  setInterval(updateHashtagTrends,    30 * 60 * 1000);
  setInterval(cleanSearchHistory,     30 * 60 * 1000);
  setInterval(updateEngagementScores, 30 * 60 * 1000);

  // Every hour
  setInterval(cleanPasswordResets, 60 * 60 * 1000);

  // Daily at midnight-ish
  const msUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0); // 00:00:05 next day
    return midnight - now;
  };
  setTimeout(function runDaily() {
    snapshotDailyAnalytics();
    setTimeout(runDaily, 24 * 60 * 60 * 1000);
  }, msUntilMidnight());
}

module.exports = { startJobs, updateHashtagTrends, updateEngagementScores };
