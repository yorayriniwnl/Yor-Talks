/**
 * Yor Talks — AI-Powered Features
 * Caption generation, hashtag suggestions, content moderation, smart replies,
 * audience insights, trend predictions, bio optimization
 */
const router = require("express").Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

async function callClaude(systemPrompt, userPrompt, maxTokens = 500) {
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// POST /api/ai/caption — generate post captions
router.post("/caption", requireAuth, async (req, res) => {
  try {
    const { image_description, tone = "engaging", post_type = "photo", audience } = req.body;
    if (!image_description) return res.status(400).json({ error: "image_description required" });

    const user = db.prepare("SELECT username, bio FROM users WHERE id=?").get(req.userId);

    const system = `You are an expert social media copywriter who creates viral, authentic captions for Instagram-like posts. 
    Generate captions that drive engagement, feel genuine, and match the creator's voice.
    Always respond with ONLY a JSON object, no markdown.`;

    const prompt = `Create 3 caption options for this post:
    Creator: @${user.username} (bio: ${user.bio || "lifestyle creator"})
    Content: ${image_description}
    Tone: ${tone} (options: engaging, inspirational, humorous, professional, personal)
    Post type: ${post_type}
    Target audience: ${audience || "general"}
    
    Return JSON: { "captions": [{ "text": "...", "tone": "...", "hook": "first line hook", "cta": "call to action" }, ...], "best_time_to_post": "..." }`;

    const raw = await callClaude(system, prompt, 800);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "AI service unavailable", details: e.message });
  }
});

// POST /api/ai/hashtags — generate hashtag strategy
router.post("/hashtags", requireAuth, async (req, res) => {
  try {
    const { caption, niche, post_type } = req.body;

    const system = `You are a hashtag strategy expert for social media growth. 
    Generate a data-driven hashtag strategy mixing trending, niche, and brand hashtags.
    Respond ONLY with JSON.`;

    const prompt = `Generate a hashtag strategy for:
    Caption: "${caption || ""}"
    Niche: ${niche || "lifestyle"}
    Post type: ${post_type || "photo"}
    
    Return JSON: {
      "hashtags": {
        "top" (1M+ posts, 5 tags): [...],
        "medium" (100K-1M posts, 10 tags): [...],
        "niche" (under 100K posts, 10 tags): [...],
        "branded" (your brand hashtags, 5 tags): [...]
      },
      "total_count": 30,
      "recommended_set": "all medium + niche for best reach",
      "avoid": ["hashtags that could shadow ban"]
    }`;

    const raw = await callClaude(system, prompt, 600);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// POST /api/ai/bio — optimize profile bio
router.post("/bio", requireAuth, async (req, res) => {
  try {
    const { current_bio, niche, goals } = req.body;
    const user = db.prepare("SELECT username, name FROM users WHERE id=?").get(req.userId);

    const system = `You are a personal branding expert who writes compelling social media bios.
    Bios must be under 150 characters, hook readers immediately, and drive follows.
    Respond ONLY with JSON.`;

    const prompt = `Optimize this bio for @${user.username}:
    Current: "${current_bio || ""}"
    Niche: ${niche || ""}
    Goals: ${goals || "grow audience, get brand deals"}
    
    Return JSON: { "bios": [{ "text": "...", "strategy": "why this works", "emoji_placement": "..." }, ...3 options] }`;

    const raw = await callClaude(system, prompt, 500);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// POST /api/ai/comment-reply — smart comment replies
router.post("/comment-reply", requireAuth, async (req, res) => {
  try {
    const { comment, post_caption } = req.body;
    if (!comment) return res.status(400).json({ error: "comment required" });

    const system = `You are a social media manager who writes authentic, engaging replies to comments.
    Replies should feel human, build community, and drive more engagement.
    Keep replies under 100 characters. Respond ONLY with JSON.`;

    const prompt = `Generate 3 reply options for this comment:
    Post: "${post_caption || ""}"
    Comment: "${comment}"
    
    Return JSON: { "replies": [{ "text": "...", "tone": "friendly/witty/thankful" }, ...] }`;

    const raw = await callClaude(system, prompt, 300);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// POST /api/ai/content-plan — generate a content calendar
router.post("/content-plan", requireAuth, async (req, res) => {
  try {
    const { niche, goals, posting_frequency = "daily", platforms = ["instagram"] } = req.body;

    const system = `You are a content strategy expert who creates viral content calendars.
    Plans should mix content types (educational, entertaining, promotional, personal) for maximum engagement.
    Respond ONLY with JSON.`;

    const prompt = `Create a 7-day content plan:
    Niche: ${niche || "lifestyle"}
    Goals: ${goals || "grow following, increase engagement"}
    Frequency: ${posting_frequency}
    Platforms: ${platforms.join(", ")}
    
    Return JSON: { "plan": [{ "day": "Monday", "date": "...", "content_type": "...", "hook": "...", "format": "photo/reel/story/carousel", "best_time": "...", "theme": "...", "notes": "..." }] }`;

    const raw = await callClaude(system, prompt, 1200);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// POST /api/ai/dm-assist — AI message drafting
router.post("/dm-assist", requireAuth, async (req, res) => {
  try {
    const { conversation_context, intent, recipient_username } = req.body;

    const system = `You are an expert at writing professional, authentic DMs for social media creators.
    Respond ONLY with JSON.`;

    const prompt = `Draft a DM:
    To: @${recipient_username || "user"}
    Intent: ${intent || "collaboration inquiry"}
    Context: ${conversation_context || "cold outreach"}
    
    Return JSON: { "messages": [{ "text": "...", "approach": "..." }] (2-3 options) }`;

    const raw = await callClaude(system, prompt, 400);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// GET /api/ai/insights — personalized creator insights
router.get("/insights", requireAuth, async (req, res) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.userId);
    const recentPosts = db.prepare("SELECT * FROM posts WHERE user_id=? ORDER BY created_at DESC LIMIT 10").all(req.userId);
    const avgLikes = recentPosts.reduce((a, p) => a + (p.likes_count || 0), 0) / Math.max(recentPosts.length, 1);
    const avgComments = recentPosts.reduce((a, p) => a + (p.comments_count || 0), 0) / Math.max(recentPosts.length, 1);

    const system = `You are a data-driven social media growth consultant.
    Provide actionable, specific insights based on real metrics.
    Respond ONLY with JSON.`;

    const prompt = `Analyze and provide growth insights:
    Creator: @${user.username}
    Followers: ${user.followers_count}
    Following: ${user.following_count}
    Posts: ${user.posts_count || recentPosts.length}
    Avg Likes: ${avgLikes.toFixed(1)}
    Avg Comments: ${avgComments.toFixed(1)}
    Engagement Rate: ${user.followers_count > 0 ? ((avgLikes + avgComments) / user.followers_count * 100).toFixed(2) : 0}%
    
    Return JSON: {
      "score": 0-100,
      "grade": "A/B/C/D/F",
      "insights": [{ "title": "...", "description": "...", "priority": "high/medium/low", "action": "specific action to take" }],
      "growth_potential": "...",
      "best_performing_content": "...",
      "optimization_tips": [...]
    }`;

    const raw = await callClaude(system, prompt, 800);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Cache result
    db.prepare("INSERT OR REPLACE INTO ai_insights (id, user_id, data, created_at) VALUES (?,?,?,datetime('now'))").run(uuidv4(), req.userId, JSON.stringify(result));
    res.json(result);
  } catch (e) {
    // Return cached insights if AI fails
    const cached = db.prepare("SELECT data FROM ai_insights WHERE user_id=? ORDER BY created_at DESC LIMIT 1").get(req.userId);
    if (cached) return res.json(JSON.parse(cached.data));
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// POST /api/ai/moderate — content moderation check
router.post("/moderate", requireAuth, async (req, res) => {
  try {
    const { text, image_description } = req.body;

    const system = `You are a content moderation AI. Check if content violates community guidelines.
    Be fair, consistent, and explain reasoning. Respond ONLY with JSON.`;

    const prompt = `Check this content:
    Text: "${text || ""}"
    Image description: "${image_description || ""}"
    
    Return JSON: { "safe": true/false, "confidence": 0-100, "categories": { "spam": false, "hate_speech": false, "violence": false, "adult_content": false, "misinformation": false }, "reason": "...", "suggestions": ["..."] }`;

    const raw = await callClaude(system, prompt, 300);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.json({ safe: true, confidence: 100, categories: {}, reason: "Moderation service unavailable — defaulting to safe" });
  }
});

// POST /api/ai/trend-predict — trending content prediction
router.post("/trend-predict", requireAuth, async (req, res) => {
  try {
    const { niche } = req.body;
    const trendingHashtags = db.prepare("SELECT name, trend_score FROM hashtags ORDER BY trend_score DESC LIMIT 20").all();

    const system = `You are a social media trends analyst who predicts viral content opportunities.
    Respond ONLY with JSON.`;

    const prompt = `Predict trending opportunities:
    Niche: ${niche || "lifestyle"}
    Current trending hashtags: ${trendingHashtags.map(h => `#${h.name}`).join(", ")}
    
    Return JSON: { "trends": [{ "topic": "...", "opportunity_score": 0-100, "why_trending": "...", "content_angle": "...", "hashtags": [...], "time_sensitive": true/false, "expected_duration": "..." }], "hot_formats": ["Reels", "Carousels", ...], "avoid": ["..."] }`;

    const raw = await callClaude(system, prompt, 600);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "AI service unavailable" });
  }
});

module.exports = router;
