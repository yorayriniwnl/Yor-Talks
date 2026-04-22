# 🎭 Yor Talks v2.0

> Production-grade Instagram replica — full-stack social platform built for scale

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-20+-green)
![React](https://img.shields.io/badge/react-18-61dafb)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## ✨ What's New in v2.0

### Critical Bug Fixes
- ✅ Fixed `require()` in React components (ESM violation)
- ✅ Fixed `window.location.pathname` hacks replaced with `useParams()`
- ✅ Fixed inline `useStore()` function definitions inside components
- ✅ Fixed missing `useParams` imports in ChatScreen
- ✅ Fixed duplicate `import` declarations in MessagesScreen
- ✅ Fixed async dynamic imports used synchronously
- ✅ All 17 screens properly separated and importable

### New Features
- 🧠 **Feed Algorithm** — Engagement scoring, recency decay, relationship signals, content diversity
- 📸 **Multi-image Carousel Posts** — Up to 10 images/videos per post with dot indicators
- 🔐 **Two-Factor Authentication** — TOTP-based 2FA with QR code setup
- 📧 **Email System** — Verification, password reset, login alerts with HTML templates
- 🔑 **Password Reset** — Forgot/reset password via email link
- 👁️ **Story Reactions** — Emoji reactions on stories (❤️🔥😍😂👏)
- 🏆 **Story Highlights** — Save stories to named highlight collections
- 💬 **Comment Replies** — Nested replies with top-reply preview
- 📌 **Pin Comments** — Post owners can pin a comment to the top
- 🧑‍🤝‍🧑 **Private Accounts** — Follow requests for private accounts
- 🤝 **Close Friends** — Green circle stories for close friends
- 🔒 **Block Users** — Full block with mutual unfollow
- 🔍 **Search History** — Recent searches with clear-all
- 🏷️ **Hashtag Pages** — Dedicated pages per hashtag with post grid
- 📊 **Analytics Dashboard** — Weekly charts, top posts, engagement rate
- 🛡️ **Admin Panel** — Stats, user management (ban/verify), report resolution
- 📦 **GDPR Export** — Full data export endpoint
- 🗑️ **Account Deletion** — Permanent account removal
- 📋 **Audit Log** — Admin action history
- 🗂️ **Saved Collections** — Organize saved posts into collections
- 👁️ **Post Views** — Track and display view counts
- 📬 **Group DMs** — Create group conversations
- 💬 **Message Reactions** — React to messages with emoji
- 🗑️ **Delete Messages** — Soft-delete individual messages
- 🗄️ **Post Archive** — Archive/unarchive posts privately
- 💾 **In-memory Cache** — LRU cache with TTL for feed & user data
- ⚙️ **Settings Screen** — Privacy, security, linked accounts

---

## 🗄️ Database (25 tables)

| Category | Tables |
|----------|--------|
| Auth | `users`, `refresh_tokens`, `password_resets` |
| Social | `follows`, `follow_requests`, `close_friends`, `blocks` |
| Content | `posts`, `post_media`, `post_tags`, `post_mentions`, `user_tags` |
| Engagement | `likes`, `saves`, `collections`, `post_views`, `comments`, `comment_likes` |
| Stories | `stories`, `story_views`, `story_reactions`, `highlights`, `highlight_stories` |
| Messaging | `conversations`, `conversation_members`, `messages` |
| Discovery | `notifications`, `hashtags`, `search_history` |
| Admin | `reports`, `audit_log` |
| Analytics | `post_analytics`, `user_analytics_daily` |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22.13+
- npm 9+

### 1. Install & seed
```bash
git clone https://github.com/yorayriniwnl/Yor-Talks.git
cd Yor-Talks
npm run setup
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set a strong JWT_SECRET
```

### 3. Start dev servers
```bash
npm run dev
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API      | http://localhost:5000 |
| Health   | http://localhost:5000/api/health |

### Demo credentials
```
Email:    yor@yortalks.com
Password: password123
Role:     Admin
```

---

## 🐳 Docker (Production)

```bash
cp backend/.env.example backend/.env
# Edit JWT_SECRET in backend/.env

npm run docker:up
# Frontend: http://localhost:3000
# API:      http://localhost:5000
```

---

## 📁 Project Structure

```
yor-talks/
├── backend/
│   ├── middleware/
│   │   ├── auth.js          # JWT auth, optionalAuth, adminOnly
│   │   └── upload.js        # Multer + Sharp (WebP, resize, crop)
│   ├── routes/
│   │   ├── auth.js          # Full auth: register, login, 2FA, reset, GDPR
│   │   ├── posts.js         # Feed algo, CRUD, carousel, like, save, comments
│   │   └── misc.js          # Users, Stories, Messages, Notifs, Search, Admin, Analytics, Explore
│   ├── utils/
│   │   ├── algorithm.js     # Feed ranking, engagement scoring, trending hashtags
│   │   ├── cache.js         # In-memory LRU cache with TTL
│   │   ├── email.js         # Nodemailer email templates
│   │   ├── helpers.js       # Post/user views, pagination, notifications, tag extraction
│   │   └── seed.js          # Rich fake-data seeder
│   ├── data/                # SQLite DB (auto-created)
│   ├── uploads/             # Media files (auto-created)
│   ├── db.js                # 25-table schema, WAL mode, indexes
│   ├── server.js            # Express + Socket.io + rate limiting
│   └── Dockerfile
│
├── frontend/
│   └── src/
│       ├── api/index.js         # All API methods (70+ endpoints)
│       ├── store/index.js       # Zustand global state
│       ├── hooks/useSocket.js   # Socket.io real-time hook
│       ├── components/
│       │   ├── Layout.jsx       # App shell, header, bottom nav
│       │   ├── PostCard.jsx     # Post, CommentsModal, PostMenu, StoryBar, StoryViewer, CreatePost, Toast
│       │   ├── CreatePost.jsx   # Re-export
│       │   └── Toast.jsx        # Re-export
│       └── screens/
│           ├── AllScreens.jsx   # All 17 screens (single file, zero circular deps)
│           ├── AuthScreen.jsx   # Login, register, 2FA flow
│           ├── HomeScreen.jsx   # Ranked feed + stories + infinite scroll
│           ├── ExploreScreen.jsx# Trending hashtags + explore grid
│           ├── SearchScreen.jsx # Live search + history
│           ├── ReelsScreen.jsx  # Swipeable full-screen reels
│           ├── NotifsScreen.jsx # Grouped notifications
│           ├── ProfileScreen.jsx# Own + other profiles + highlights
│           ├── EditProfile.jsx  # Edit name, bio, avatar, gender
│           ├── MessagesScreen.jsx # DM list
│           ├── ChatScreen.jsx   # Real-time chat + typing indicators
│           ├── PostScreen.jsx   # Post detail
│           ├── SavedScreen.jsx  # Saved posts grid
│           ├── ArchiveScreen.jsx# Archived posts
│           ├── AnalyticsScreen.jsx # Weekly chart, top posts
│           ├── SettingsScreen.jsx  # Account settings
│           ├── AdminScreen.jsx  # Stats, users, reports
│           └── HashtagScreen.jsx# Hashtag post grid
│
├── docker-compose.yml
├── package.json              # Monorepo: npm run dev | setup | docker:up
└── README.md
```

---

## 🌐 API Reference (50+ endpoints)

### Auth `/api/auth`
`POST /register` · `POST /login` · `POST /refresh` · `POST /logout`
`GET /me` · `PATCH /me` · `POST /avatar`
`POST /change-password` · `POST /forgot-password` · `POST /reset-password`
`GET /verify-email` · `POST /2fa/setup` · `POST /2fa/enable` · `POST /2fa/disable`
`GET /sessions` · `DELETE /sessions/:id` · `POST /gdpr/export` · `DELETE /account`

### Posts `/api/posts`
`GET /feed` · `GET /explore` · `GET /saved` · `GET /archived`
`POST /` · `GET /:id` · `PATCH /:id` · `DELETE /:id`
`POST /:id/archive` · `POST /:id/like` · `POST /:id/save`
`GET /:id/comments` · `POST /:id/comments` · `POST /:id/comments/:cid/like`
`DELETE /:id/comments/:cid` · `POST /:id/pin-comment`
`POST /:id/report` · `GET /:id/analytics` · `GET /:id/likes-list`

### Users `/api/users`
`GET /search` · `GET /suggestions` · `GET /:username` · `GET /:username/posts`
`GET /:username/followers` · `GET /:username/following`
`POST /:username/follow` · `POST /:username/block` · `POST /:username/close-friends`
`GET /follow-requests/list` · `POST /:id/follow-requests/:action` · `GET /tagged/:username`

### Stories `/api/stories`
`GET /feed` · `POST /` · `POST /:id/view` · `POST /:id/react`
`GET /:id/viewers` · `DELETE /:id`
`GET /highlights/:userId` · `POST /highlights` · `DELETE /highlights/:id`

### Messages `/api/messages`
`GET /conversations` · `POST /conversations`
`GET /conversations/:id/messages`
`DELETE /messages/:id` · `POST /messages/:id/react`

### Other
`GET|POST /api/notifs` · `GET /api/search` · `GET /api/explore/trending`
`GET /api/explore/hashtag/:tag` · `GET /api/explore/reels`
`GET /api/analytics/overview` · `GET /api/admin/stats`
`GET|POST /api/admin/users` · `GET|POST /api/admin/reports`

---

## 🔌 Socket.io Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Client→Server | `join_conversation` | Join DM room |
| Client→Server | `send_message` | Send a message |
| Client→Server | `typing` | Typing indicator |
| Client→Server | `react_message` | React to a message |
| Client→Server | `read_conversation` | Mark as read |
| Client→Server | `post_liked` | Broadcast like |
| Client→Server | `new_story` | Broadcast new story |
| Server→Client | `new_message` | New DM received |
| Server→Client | `typing` | Typing status update |
| Server→Client | `presence` | User online/offline |
| Server→Client | `message_reaction` | Message reaction update |
| Server→Client | `conversation_read` | Read receipt |
| Server→Client | `post_stats_update` | Like/comment count update |
| Server→Client | `story_added` | New story available |

---

## 🔒 Security

- **bcrypt** password hashing (cost 12)
- **JWT** access (30min) + rotating refresh tokens (30d)
- **Helmet** security headers
- **Rate limiting**: 600/15min global, 15/15min auth
- **Input validation** via express-validator on all mutations
- **CORS** restricted to configured origin
- **SQL injection** prevented by parameterized queries
- **Account suspension** with token revocation
- **2FA** via TOTP (Google Authenticator compatible)
- **GDPR** data export + account deletion

---

## 📈 Scaling Path

When you outgrow single-server:
1. **PostgreSQL** — swap `better-sqlite3` for `pg`
2. **Redis** — replace in-memory cache, Socket.io adapter for multi-instance
3. **S3/Cloudflare R2** — move file uploads off local disk
4. **CDN** — serve `dist/` and uploads via CDN
5. **PM2 / Kubernetes** — cluster Node.js processes
6. **Separate media service** — FFmpeg worker for video transcoding

---

## 📄 License

MIT © 2024 Yor Talks
