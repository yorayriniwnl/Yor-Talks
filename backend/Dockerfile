FROM node:20-alpine
RUN apk add --no-cache python3 make g++ curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p data uploads
EXPOSE 5000
CMD ["sh", "-c", "node utils/seed.js && node server.js"]
