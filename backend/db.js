const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "yortalks.db");
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const sqlite = new DatabaseSync(DB_PATH);

function wrapStatement(statement) {
  return {
    all(...args) {
      return statement.all(...args);
    },
    get(...args) {
      return statement.get(...args);
    },
    run(...args) {
      return statement.run(...args);
    },
    iterate(...args) {
      return statement.iterate(...args);
    },
  };
}

const db = {
  exec(sql) {
    return sqlite.exec(sql);
  },
  pragma(sql) {
    const pragmaSql = String(sql).trim();
    return sqlite.exec(pragmaSql.startsWith("PRAGMA ") ? pragmaSql : `PRAGMA ${pragmaSql}`);
  },
  prepare(sql) {
    return wrapStatement(sqlite.prepare(sql));
  },
  transaction(fn) {
    return (...args) => {
      sqlite.exec("BEGIN");
      try {
        const result = fn(...args);
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          sqlite.exec("ROLLBACK");
        } catch {}
        throw error;
      }
    };
  },
  close() {
    return sqlite.close();
  },
};

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("cache_size = -32000"); // 32MB cache

db.exec(`
  -- ── USERS ──────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS users (
    id               TEXT PRIMARY KEY,
    username         TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email            TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password         TEXT NOT NULL,
    name             TEXT NOT NULL,
    bio              TEXT DEFAULT '',
    avatar           TEXT DEFAULT '',
    website          TEXT DEFAULT '',
    phone            TEXT DEFAULT '',
    gender           TEXT DEFAULT '',
    is_private       INTEGER DEFAULT 0,
    is_verified      INTEGER DEFAULT 0,
    is_admin         INTEGER DEFAULT 0,
    is_banned        INTEGER DEFAULT 0,
    ban_reason       TEXT DEFAULT '',
    email_verified   INTEGER DEFAULT 0,
    email_verify_token TEXT,
    two_factor_secret TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    show_activity    INTEGER DEFAULT 1,
    allow_tagging    TEXT DEFAULT 'everyone',
    followers_count  INTEGER DEFAULT 0,
    following_count  INTEGER DEFAULT 0,
    posts_count      INTEGER DEFAULT 0,
    last_seen        TEXT DEFAULT (datetime('now')),
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
  );

  -- ── AUTH ────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    token      TEXT NOT NULL,
    device     TEXT DEFAULT '',
    ip         TEXT DEFAULT '',
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    token      TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ── SOCIAL GRAPH ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS follows (
    follower_id  TEXT NOT NULL,
    following_id TEXT NOT NULL,
    status       TEXT DEFAULT 'active',
    created_at   TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS follow_requests (
    id           TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    target_id    TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id)    REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS close_friends (
    user_id    TEXT NOT NULL,
    friend_id  TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (blocker_id, blocked_id),
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ── POSTS ───────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS posts (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    caption         TEXT DEFAULT '',
    location        TEXT DEFAULT '',
    location_lat    REAL,
    location_lng    REAL,
    visibility      TEXT DEFAULT 'public',
    is_archived     INTEGER DEFAULT 0,
    is_draft        INTEGER DEFAULT 0,
    scheduled_at    TEXT,
    likes_count     INTEGER DEFAULT 0,
    comments_count  INTEGER DEFAULT 0,
    saves_count     INTEGER DEFAULT 0,
    shares_count    INTEGER DEFAULT 0,
    views_count     INTEGER DEFAULT 0,
    reach_count     INTEGER DEFAULT 0,
    engagement_score REAL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS post_media (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL,
    url        TEXT NOT NULL,
    type       TEXT DEFAULT 'image',
    width      INTEGER DEFAULT 0,
    height     INTEGER DEFAULT 0,
    duration   INTEGER DEFAULT 0,
    position   INTEGER DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS post_tags (
    post_id TEXT NOT NULL,
    tag     TEXT NOT NULL COLLATE NOCASE,
    PRIMARY KEY (post_id, tag),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS post_mentions (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_tags (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    x_pct   REAL DEFAULT 50,
    y_pct   REAL DEFAULT 50,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ── ENGAGEMENT ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS likes (
    user_id    TEXT NOT NULL,
    post_id    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS saves (
    user_id        TEXT NOT NULL,
    post_id        TEXT NOT NULL,
    collection_id  TEXT,
    created_at     TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS collections (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    cover_url  TEXT DEFAULT '',
    is_private INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS post_views (
    user_id    TEXT NOT NULL,
    post_id    TEXT NOT NULL,
    viewed_at  TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id          TEXT PRIMARY KEY,
    post_id     TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    parent_id   TEXT,
    text        TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    is_pinned   INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id)   REFERENCES posts(id)    ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    user_id    TEXT NOT NULL,
    comment_id TEXT NOT NULL,
    PRIMARY KEY (user_id, comment_id),
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
  );

  -- ── STORIES ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS stories (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    media_url   TEXT NOT NULL,
    media_type  TEXT DEFAULT 'image',
    thumbnail   TEXT DEFAULT '',
    text        TEXT DEFAULT '',
    text_style  TEXT DEFAULT '{}',
    stickers    TEXT DEFAULT '[]',
    bg_color    TEXT DEFAULT '',
    music_id    TEXT DEFAULT '',
    duration    INTEGER DEFAULT 5000,
    link        TEXT DEFAULT '',
    audience    TEXT DEFAULT 'all',
    expires_at  TEXT NOT NULL,
    views_count INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS story_views (
    story_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    viewed_at  TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (story_id, user_id),
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS story_reactions (
    story_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (story_id, user_id),
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS highlights (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    cover_url  TEXT DEFAULT '',
    position   INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS highlight_stories (
    highlight_id TEXT NOT NULL,
    story_id     TEXT NOT NULL,
    added_at     TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (highlight_id, story_id),
    FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id)     REFERENCES stories(id)    ON DELETE CASCADE
  );

  -- ── MESSAGING ───────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS conversations (
    id           TEXT PRIMARY KEY,
    name         TEXT DEFAULT '',
    avatar       TEXT DEFAULT '',
    type         TEXT DEFAULT 'dm',
    created_by   TEXT,
    last_message_id TEXT,
    updated_at   TEXT DEFAULT (datetime('now')),
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    role            TEXT DEFAULT 'member',
    joined_at       TEXT DEFAULT (datetime('now')),
    last_read_at    TEXT DEFAULT (datetime('now')),
    is_muted        INTEGER DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id       TEXT NOT NULL,
    text            TEXT,
    media_url       TEXT,
    media_type      TEXT DEFAULT 'text',
    reply_to_id     TEXT,
    shared_post_id  TEXT,
    is_deleted      INTEGER DEFAULT 0,
    reactions       TEXT DEFAULT '{}',
    is_read         INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE,
    FOREIGN KEY (reply_to_id)     REFERENCES messages(id)      ON DELETE SET NULL
  );

  -- ── NOTIFICATIONS ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    actor_id    TEXT NOT NULL,
    type        TEXT NOT NULL,
    entity_id   TEXT,
    entity_type TEXT,
    data        TEXT DEFAULT '{}',
    is_read     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ── SEARCH & DISCOVERY ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS hashtags (
    id          TEXT PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL COLLATE NOCASE,
    posts_count INTEGER DEFAULT 0,
    trend_score REAL DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    query      TEXT NOT NULL,
    type       TEXT DEFAULT 'text',
    entity_id  TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ── MODERATION ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS reports (
    id           TEXT PRIMARY KEY,
    reporter_id  TEXT NOT NULL,
    entity_id    TEXT NOT NULL,
    entity_type  TEXT NOT NULL,
    reason       TEXT NOT NULL,
    details      TEXT DEFAULT '',
    status       TEXT DEFAULT 'pending',
    reviewed_by  TEXT,
    reviewed_at  TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         TEXT PRIMARY KEY,
    admin_id   TEXT NOT NULL,
    action     TEXT NOT NULL,
    entity_id  TEXT,
    entity_type TEXT,
    data       TEXT DEFAULT '{}',
    ip         TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ── ANALYTICS ───────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS post_analytics (
    id           TEXT PRIMARY KEY,
    post_id      TEXT NOT NULL UNIQUE,
    impressions  INTEGER DEFAULT 0,
    reach        INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    website_clicks INTEGER DEFAULT 0,
    saves        INTEGER DEFAULT 0,
    shares       INTEGER DEFAULT 0,
    updated_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_analytics_daily (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    date           TEXT NOT NULL,
    impressions    INTEGER DEFAULT 0,
    reach          INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    new_followers  INTEGER DEFAULT 0,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ── INDEXES ─────────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_posts_user        ON posts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_posts_explore     ON posts(engagement_score DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_posts_archived    ON posts(user_id, is_archived);
  CREATE INDEX IF NOT EXISTS idx_post_media_post   ON post_media(post_id, position);
  CREATE INDEX IF NOT EXISTS idx_likes_post        ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_likes_user        ON likes(user_id);
  CREATE INDEX IF NOT EXISTS idx_saves_user        ON saves(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_post     ON comments(post_id, parent_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_stories_user      ON stories(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_stories_expires   ON stories(expires_at);
  CREATE INDEX IF NOT EXISTS idx_notifs_user       ON notifications(user_id, is_read, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_conv     ON messages(conversation_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_hashtags_trend    ON hashtags(trend_score DESC);
  CREATE INDEX IF NOT EXISTS idx_search_user       ON search_history(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_post_tags         ON post_tags(tag);
  CREATE INDEX IF NOT EXISTS idx_reports_status    ON reports(status, created_at DESC);
`);

module.exports = db;
