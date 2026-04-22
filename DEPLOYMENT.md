## ── Production Deployment Guide ──────────────────────────────────────────────

### 1. Single VPS (DigitalOcean / Linode / Hetzner)

```
# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Clone & setup
git clone https://github.com/yorayriniwnl/Yor-Talks.git
cd Yor-Talks
bash setup.sh

# Build frontend
cd frontend && npm run build && cd ..

# Update backend .env
nano backend/.env
# Set: NODE_ENV=production, JWT_SECRET=<random 64 chars>, CLIENT_URL=https://yourdomain.com

# Start API with PM2
cd backend
pm2 start server.js --name yor-talks-api
pm2 startup && pm2 save

# Serve frontend with nginx
sudo apt install nginx -y
# Copy frontend/dist to /var/www/yor-talks
# Configure nginx (see nginx.conf in repo)

# HTTPS with Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

### 2. Docker (Recommended for prod)

```bash
# Edit docker-compose.yml environment section
# Set JWT_SECRET and CLIENT_URL

docker-compose up --build -d

# Scale API
docker-compose up --scale backend=2 -d
```

### 3. Railway / Render (Zero-config)

**Backend:**
- New service → "Deploy from GitHub" → select repo
- Set build command: `cd backend && npm install`
- Set start command: `cd backend && node utils/seed.js && node server.js`
- Add env vars from backend/.env.example

**Frontend:**
- New static site → select repo
- Build command: `cd frontend && npm install && npm run build`
- Publish directory: `frontend/dist`
- Add: `VITE_API_URL=<your-backend-url>`

### 4. AWS ECS / GCP Cloud Run

Use the provided Dockerfiles. The backend container exposes port 5000.
Mount a persistent volume for `/app/data` (SQLite) and `/app/uploads`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default: 5000) |
| `NODE_ENV` | Yes (prod) | Set to `production` |
| `JWT_SECRET` | Yes | Random 32+ char string |
| `CLIENT_URL` | Yes | Frontend URL (for CORS) |
| `DB_PATH` | No | SQLite path (default: ./data/yortalks.db) |
| `UPLOAD_DIR` | No | Uploads path (default: ./uploads) |
| `SMTP_HOST` | No | Email server host |
| `SMTP_USER` | No | Email username |
| `SMTP_PASS` | No | Email password |

### Upgrading from SQLite to PostgreSQL

1. Install `pg`: `npm install pg`
2. Replace `better-sqlite3` calls with `pg` pool queries
3. Schema is compatible — just change syntax from `?` to `$1,$2`
4. Use `DATABASE_URL=postgres://...` env var

### S3 Upload Storage

Replace local file storage in `middleware/upload.js`:
```js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: process.env.AWS_REGION });
// Replace fs.writeFileSync with s3.send(new PutObjectCommand(...))
```

### Monitoring

- Health endpoint: `GET /api/health`
- Cache stats: `GET /api/cache/stats`
- Online users: `GET /api/online`

Recommended: Set up UptimeRobot to ping `/api/health` every 5 minutes.
