/**
 * Yor Talks — Creator Economy Routes
 * Subscriptions, tips, earnings, payouts, brand partnerships, creator analytics
 */
const router = require("express").Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

// ─── Creator Profile ─────────────────────────────────────────────────────────

// GET /api/creator/profile/:username
router.get("/profile/:username", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, username, name, avatar, bio, verified, followers_count, following_count FROM users WHERE username=?").get(req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });

  const creatorProfile = db.prepare("SELECT * FROM creator_profiles WHERE user_id=?").get(user.id);
  if (!creatorProfile) return res.json({ user, creator: null });

  const tiers = db.prepare("SELECT * FROM subscription_tiers WHERE creator_id=? AND active=1 ORDER BY price ASC").all(user.id);
  const isSubscribed = db.prepare("SELECT * FROM subscriptions WHERE subscriber_id=? AND creator_id=? AND status='active'").get(req.userId, user.id);
  const totalEarnings = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM creator_earnings WHERE creator_id=? AND status='completed'").get(user.id);
  const monthlyEarnings = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM creator_earnings WHERE creator_id=? AND status='completed' AND created_at > datetime('now','-30 days')").get(user.id);

  res.json({
    user,
    creator: creatorProfile,
    tiers,
    is_subscribed: !!isSubscribed,
    subscription: isSubscribed || null,
    stats: {
      total_earnings: totalEarnings.total,
      monthly_earnings: monthlyEarnings.total,
      subscriber_count: db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE creator_id=? AND status='active'").get(user.id).c,
      tip_count: db.prepare("SELECT COUNT(*) as c FROM tips WHERE creator_id=?").get(user.id).c,
    }
  });
});

// POST /api/creator/onboard — become a creator
router.post("/onboard", requireAuth, (req, res) => {
  const { bio, category, payment_email, youtube_url, tiktok_url, twitter_url } = req.body;
  const existing = db.prepare("SELECT id FROM creator_profiles WHERE user_id=?").get(req.userId);
  if (existing) return res.status(400).json({ error: "Already a creator" });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO creator_profiles (id, user_id, bio, category, payment_email, youtube_url, tiktok_url, twitter_url, verified, total_earnings, created_at)
    VALUES (?,?,?,?,?,?,?,?,0,0,datetime('now'))
  `).run(id, req.userId, bio || "", category || "lifestyle", payment_email || "", youtube_url || "", tiktok_url || "", twitter_url || "");

  db.prepare("UPDATE users SET is_creator=1 WHERE id=?").run(req.userId);
  res.json({ success: true, creator_id: id });
});

// PATCH /api/creator/profile — update creator settings
router.patch("/profile", requireAuth, (req, res) => {
  const { bio, category, payment_email, youtube_url, tiktok_url, twitter_url, subscription_enabled, tips_enabled, shop_enabled } = req.body;
  const cp = db.prepare("SELECT id FROM creator_profiles WHERE user_id=?").get(req.userId);
  if (!cp) return res.status(404).json({ error: "Not a creator" });

  db.prepare(`
    UPDATE creator_profiles SET
      bio=COALESCE(?,bio), category=COALESCE(?,category),
      payment_email=COALESCE(?,payment_email), youtube_url=COALESCE(?,youtube_url),
      tiktok_url=COALESCE(?,tiktok_url), twitter_url=COALESCE(?,twitter_url),
      subscription_enabled=COALESCE(?,subscription_enabled),
      tips_enabled=COALESCE(?,tips_enabled), shop_enabled=COALESCE(?,shop_enabled)
    WHERE user_id=?
  `).run(bio, category, payment_email, youtube_url, tiktok_url, twitter_url, subscription_enabled !== undefined ? (subscription_enabled?1:0) : null, tips_enabled !== undefined ? (tips_enabled?1:0) : null, shop_enabled !== undefined ? (shop_enabled?1:0) : null, req.userId);

  res.json({ success: true });
});

// ─── Subscription Tiers ───────────────────────────────────────────────────────

// GET /api/creator/tiers/:creatorId
router.get("/tiers/:creatorId", requireAuth, (req, res) => {
  const tiers = db.prepare("SELECT * FROM subscription_tiers WHERE creator_id=? AND active=1 ORDER BY price ASC").all(req.params.creatorId);
  res.json({ tiers });
});

// POST /api/creator/tiers — create tier
router.post("/tiers", requireAuth, (req, res) => {
  const { name, description, price, perks } = req.body;
  if (!name || !price) return res.status(400).json({ error: "name and price required" });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO subscription_tiers (id, creator_id, name, description, price, perks, active, subscriber_count, created_at)
    VALUES (?,?,?,?,?,?,1,0,datetime('now'))
  `).run(id, req.userId, name, description || "", price, JSON.stringify(perks || []));

  res.json({ success: true, tier_id: id });
});

// DELETE /api/creator/tiers/:id — deactivate tier
router.delete("/tiers/:id", requireAuth, (req, res) => {
  db.prepare("UPDATE subscription_tiers SET active=0 WHERE id=? AND creator_id=?").run(req.params.id, req.userId);
  res.json({ success: true });
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

// POST /api/creator/subscribe — subscribe to a creator
router.post("/subscribe", requireAuth, (req, res) => {
  const { creator_id, tier_id } = req.body;
  if (!creator_id || !tier_id) return res.status(400).json({ error: "creator_id and tier_id required" });

  const tier = db.prepare("SELECT * FROM subscription_tiers WHERE id=? AND creator_id=? AND active=1").get(tier_id, creator_id);
  if (!tier) return res.status(404).json({ error: "Tier not found" });

  const existing = db.prepare("SELECT * FROM subscriptions WHERE subscriber_id=? AND creator_id=? AND status='active'").get(req.userId, creator_id);
  if (existing) return res.status(400).json({ error: "Already subscribed" });

  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO subscriptions (id, subscriber_id, creator_id, tier_id, status, amount, expires_at, created_at)
    VALUES (?,?,?,?,?,?,?,datetime('now'))
  `).run(id, req.userId, creator_id, tier_id, "active", tier.price, expiresAt);

  db.prepare("UPDATE subscription_tiers SET subscriber_count=subscriber_count+1 WHERE id=?").run(tier_id);

  // Record earnings
  const earnId = uuidv4();
  const platformFee = Math.round(tier.price * 0.2); // 20% platform fee
  const creatorEarning = tier.price - platformFee;
  db.prepare(`
    INSERT INTO creator_earnings (id, creator_id, source_type, source_id, amount, platform_fee, net_amount, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'))
  `).run(earnId, creator_id, "subscription", id, tier.price, platformFee, creatorEarning, "completed");
  db.prepare("UPDATE creator_profiles SET total_earnings=total_earnings+? WHERE user_id=?").run(creatorEarning, creator_id);

  // Notify creator
  const sub = db.prepare("SELECT username FROM users WHERE id=?").get(req.userId);
  db.prepare("INSERT INTO notifications (id, user_id, type, from_user_id, data, created_at) VALUES (?,?,?,?,?,datetime('now'))").run(
    uuidv4(), creator_id, "new_subscriber", req.userId,
    JSON.stringify({ subscriber: sub.username, tier: tier.name, amount: tier.price })
  );

  res.json({ success: true, subscription_id: id, expires_at: expiresAt });
});

// DELETE /api/creator/subscribe/:creatorId — cancel subscription
router.delete("/subscribe/:creatorId", requireAuth, (req, res) => {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE subscriber_id=? AND creator_id=? AND status='active'").get(req.userId, req.params.creatorId);
  if (!sub) return res.status(404).json({ error: "No active subscription" });

  db.prepare("UPDATE subscriptions SET status='cancelled', cancelled_at=datetime('now') WHERE id=?").run(sub.id);
  db.prepare("UPDATE subscription_tiers SET subscriber_count=MAX(0,subscriber_count-1) WHERE id=?").run(sub.tier_id);
  res.json({ success: true });
});

// GET /api/creator/my-subscriptions — what I'm subscribed to
router.get("/my-subscriptions", requireAuth, (req, res) => {
  const subs = db.prepare(`
    SELECT s.*, u.username, u.name, u.avatar, u.verified, st.name as tier_name, st.price, st.perks
    FROM subscriptions s
    JOIN users u ON u.id=s.creator_id
    JOIN subscription_tiers st ON st.id=s.tier_id
    WHERE s.subscriber_id=? AND s.status='active'
    ORDER BY s.created_at DESC
  `).all(req.userId);
  res.json({ subscriptions: subs });
});

// GET /api/creator/my-subscribers — who subscribes to me
router.get("/my-subscribers", requireAuth, (req, res) => {
  const { page=1, limit=20 } = req.query;
  const offset = (page-1) * limit;
  const subs = db.prepare(`
    SELECT s.*, u.username, u.name, u.avatar, st.name as tier_name, st.price
    FROM subscriptions s
    JOIN users u ON u.id=s.subscriber_id
    JOIN subscription_tiers st ON st.id=s.tier_id
    WHERE s.creator_id=? AND s.status='active'
    ORDER BY s.created_at DESC LIMIT ? OFFSET ?
  `).all(req.userId, limit, offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE creator_id=? AND status='active'").get(req.userId).c;
  res.json({ subscribers: subs, total, page: +page });
});

// ─── Tips ─────────────────────────────────────────────────────────────────────

// POST /api/creator/tip — send a tip
router.post("/tip", requireAuth, (req, res) => {
  const { creator_id, amount, message } = req.body;
  if (!creator_id || !amount || amount < 1) return res.status(400).json({ error: "creator_id and amount (min $1) required" });

  const creator = db.prepare("SELECT id,username FROM users WHERE id=?").get(creator_id);
  if (!creator) return res.status(404).json({ error: "Creator not found" });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tips (id, tipper_id, creator_id, amount, message, created_at)
    VALUES (?,?,?,?,?,datetime('now'))
  `).run(id, req.userId, creator_id, amount, message || "");

  // Record earnings
  const platformFee = Math.round(amount * 0.15); // 15% tip fee
  const net = amount - platformFee;
  db.prepare(`
    INSERT INTO creator_earnings (id, creator_id, source_type, source_id, amount, platform_fee, net_amount, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'))
  `).run(uuidv4(), creator_id, "tip", id, amount, platformFee, net, "completed");
  db.prepare("UPDATE creator_profiles SET total_earnings=total_earnings+? WHERE user_id=?").run(net, creator_id);

  // Notify
  const tipper = db.prepare("SELECT username FROM users WHERE id=?").get(req.userId);
  db.prepare("INSERT INTO notifications (id, user_id, type, from_user_id, data, created_at) VALUES (?,?,?,?,?,datetime('now'))").run(
    uuidv4(), creator_id, "tip_received", req.userId,
    JSON.stringify({ tipper: tipper.username, amount, message })
  );

  res.json({ success: true, tip_id: id });
});

// GET /api/creator/tips — my received tips
router.get("/tips", requireAuth, (req, res) => {
  const tips = db.prepare(`
    SELECT t.*, u.username, u.name, u.avatar
    FROM tips t JOIN users u ON u.id=t.tipper_id
    WHERE t.creator_id=? ORDER BY t.created_at DESC LIMIT 50
  `).all(req.userId);
  res.json({ tips });
});

// ─── Earnings & Payouts ───────────────────────────────────────────────────────

// GET /api/creator/earnings — earnings dashboard
router.get("/earnings", requireAuth, (req, res) => {
  const { period = "30d" } = req.query;
  const dateFilter = period === "7d" ? "-7 days" : period === "90d" ? "-90 days" : "-30 days";

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(net_amount),0) as total_net,
      COALESCE(SUM(amount),0) as total_gross,
      COALESCE(SUM(platform_fee),0) as total_fees,
      COUNT(*) as transaction_count,
      SUM(CASE WHEN source_type='subscription' THEN net_amount ELSE 0 END) as subscription_earnings,
      SUM(CASE WHEN source_type='tip' THEN net_amount ELSE 0 END) as tip_earnings,
      SUM(CASE WHEN source_type='shop' THEN net_amount ELSE 0 END) as shop_earnings,
      SUM(CASE WHEN source_type='brand_deal' THEN net_amount ELSE 0 END) as brand_earnings
    FROM creator_earnings WHERE creator_id=? AND status='completed' AND created_at > datetime('now',?)
  `).get(req.userId, dateFilter);

  const daily = db.prepare(`
    SELECT date(created_at) as day, SUM(net_amount) as earnings, COUNT(*) as transactions
    FROM creator_earnings WHERE creator_id=? AND status='completed' AND created_at > datetime('now',?)
    GROUP BY day ORDER BY day ASC
  `).all(req.userId, dateFilter);

  const pending = db.prepare("SELECT COALESCE(SUM(net_amount),0) as total FROM creator_earnings WHERE creator_id=? AND status='pending'").get(req.userId);
  const paidOut = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM payouts WHERE creator_id=? AND status='completed'").get(req.userId);

  res.json({ summary, daily, pending_balance: pending.total, total_paid_out: paidOut.total });
});

// POST /api/creator/payout — request payout
router.post("/payout", requireAuth, (req, res) => {
  const cp = db.prepare("SELECT * FROM creator_profiles WHERE user_id=?").get(req.userId);
  if (!cp) return res.status(404).json({ error: "Not a creator" });
  if (!cp.payment_email) return res.status(400).json({ error: "Set payment email first" });

  const available = db.prepare("SELECT COALESCE(SUM(net_amount),0) as total FROM creator_earnings WHERE creator_id=? AND status='completed'").get(req.userId).total
    - db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM payouts WHERE creator_id=? AND status IN ('pending','completed')").get(req.userId).total;

  if (available < 50) return res.status(400).json({ error: `Minimum payout is $50. Available: $${available.toFixed(2)}` });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO payouts (id, creator_id, amount, payment_email, status, created_at)
    VALUES (?,?,?,?,?,datetime('now'))
  `).run(id, req.userId, available, cp.payment_email, "pending");

  res.json({ success: true, payout_id: id, amount: available, eta: "3-5 business days" });
});

// ─── Brand Deals / Marketplace ────────────────────────────────────────────────

// GET /api/creator/brand-deals — my brand deals
router.get("/brand-deals", requireAuth, (req, res) => {
  const deals = db.prepare(`
    SELECT bd.*, b.name as brand_name, b.logo_url
    FROM brand_deals bd
    JOIN brands b ON b.id=bd.brand_id
    WHERE bd.creator_id=? ORDER BY bd.created_at DESC
  `).all(req.userId);
  res.json({ deals });
});

// POST /api/creator/brand-deals/:id/accept — accept a deal
router.post("/brand-deals/:id/accept", requireAuth, (req, res) => {
  const deal = db.prepare("SELECT * FROM brand_deals WHERE id=? AND creator_id=? AND status='offered'").get(req.params.id, req.userId);
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  db.prepare("UPDATE brand_deals SET status='accepted', accepted_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// POST /api/creator/brand-deals/:id/decline
router.post("/brand-deals/:id/decline", requireAuth, (req, res) => {
  db.prepare("UPDATE brand_deals SET status='declined' WHERE id=? AND creator_id=?").run(req.params.id, req.userId);
  res.json({ success: true });
});

// ─── Creator Analytics ────────────────────────────────────────────────────────

// GET /api/creator/analytics — deep creator analytics
router.get("/analytics", requireAuth, (req, res) => {
  const { period="30d" } = req.query;
  const dateFilter = period === "7d" ? "-7 days" : period === "90d" ? "-90 days" : "-30 days";

  const postStats = db.prepare(`
    SELECT
      COUNT(*) as total_posts,
      COALESCE(SUM(likes_count),0) as total_likes,
      COALESCE(SUM(comments_count),0) as total_comments,
      COALESCE(SUM(saves_count),0) as total_saves,
      COALESCE(SUM(views_count),0) as total_views,
      COALESCE(AVG(likes_count),0) as avg_likes,
      COALESCE(AVG(comments_count),0) as avg_comments
    FROM posts WHERE user_id=? AND created_at > datetime('now',?)
  `).get(req.userId, dateFilter);

  const followerGrowth = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as new_followers
    FROM follows WHERE following_id=? AND created_at > datetime('now',?)
    GROUP BY day ORDER BY day ASC
  `).all(req.userId, dateFilter);

  const topPosts = db.prepare(`
    SELECT id, caption, image_url, likes_count, comments_count, saves_count, views_count, created_at
    FROM posts WHERE user_id=? ORDER BY engagement_score DESC LIMIT 5
  `).all(req.userId);

  const audienceGender = [
    { label: "Female", value: 54 },
    { label: "Male", value: 40 },
    { label: "Other", value: 6 }
  ];

  const audienceAge = [
    { range: "13-17", value: 8 },
    { range: "18-24", value: 32 },
    { range: "25-34", value: 35 },
    { range: "35-44", value: 16 },
    { range: "45+", value: 9 }
  ];

  const user = db.prepare("SELECT followers_count, following_count FROM users WHERE id=?").get(req.userId);
  const engagementRate = user.followers_count > 0
    ? ((postStats.avg_likes + postStats.avg_comments) / user.followers_count * 100).toFixed(2)
    : 0;

  res.json({
    post_stats: postStats,
    follower_growth: followerGrowth,
    top_posts: topPosts,
    audience: { gender: audienceGender, age: audienceAge },
    engagement_rate: +engagementRate,
    follower_count: user.followers_count,
    reach_estimate: Math.round(user.followers_count * 0.15),
    impression_estimate: Math.round(user.followers_count * 0.42),
  });
});

// ─── Creator Exclusive Content ────────────────────────────────────────────────

// GET /api/creator/exclusive/:username — exclusive posts for subscribers
router.get("/exclusive/:username", requireAuth, (req, res) => {
  const creator = db.prepare("SELECT id FROM users WHERE username=?").get(req.params.username);
  if (!creator) return res.status(404).json({ error: "Not found" });

  const isSubscribed = db.prepare("SELECT 1 FROM subscriptions WHERE subscriber_id=? AND creator_id=? AND status='active'").get(req.userId, creator.id);
  if (!isSubscribed && req.userId !== creator.id) return res.status(403).json({ error: "Subscribe to view exclusive content", requires_subscription: true });

  const posts = db.prepare("SELECT * FROM posts WHERE user_id=? AND is_exclusive=1 ORDER BY created_at DESC LIMIT 20").all(creator.id);
  res.json({ posts });
});

module.exports = router;
