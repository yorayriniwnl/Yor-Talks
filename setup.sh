#!/usr/bin/env bash
# ── Yor Talks Setup Script ─────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}  ╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}  ║        🎭 Yor Talks v2.0 Setup        ║${NC}"
echo -e "${BLUE}  ╚═══════════════════════════════════════╝${NC}"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌  Node.js is required (v18+). Download: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌  Node.js 18+ required. You have $(node -v)"
  exit 1
fi

echo -e "${GREEN}✅  Node.js $(node -v) detected${NC}"

# Install backend
echo ""
echo -e "${YELLOW}📦  Installing backend dependencies...${NC}"
cd backend && npm install --silent && cd ..
echo -e "${GREEN}✅  Backend installed${NC}"

# Install frontend
echo ""
echo -e "${YELLOW}📦  Installing frontend dependencies...${NC}"
cd frontend && npm install --silent && cd ..
echo -e "${GREEN}✅  Frontend installed${NC}"

# Setup .env
if [ ! -f "backend/.env" ]; then
  echo ""
  echo -e "${YELLOW}⚙️   Creating backend/.env ...${NC}"
  cp backend/.env.example backend/.env
  # Generate a random JWT secret
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i.bak "s/yor-talks-change-this-secret-min-32-chars-xyz/$SECRET/" backend/.env
  rm -f backend/.env.bak
  echo -e "${GREEN}✅  .env created with a secure JWT_SECRET${NC}"
fi

# Seed
echo ""
echo -e "${YELLOW}🌱  Seeding database...${NC}"
cd backend && node utils/seed.js && cd ..
echo -e "${GREEN}✅  Database seeded${NC}"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  🚀 Setup complete! Run:${NC}"
echo ""
echo -e "  ${YELLOW}npm run dev${NC}  — starts both servers"
echo ""
echo -e "  Frontend  →  ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend   →  ${BLUE}http://localhost:5000${NC}"
echo -e "  Health    →  ${BLUE}http://localhost:5000/api/health${NC}"
echo ""
echo -e "  Demo:  ${YELLOW}yor@yortalks.com${NC} / ${YELLOW}password123${NC}  (admin)"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
