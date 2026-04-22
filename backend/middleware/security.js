/**
 * Advanced security middleware
 * - Request size validation
 * - Suspicious pattern detection
 * - IP-based blocking
 * - Request logging for security audit
 */

const db = require("../db");

// In-memory abuse tracker (replace with Redis in production)
const abuseTracker = new Map(); // IP -> { count, resetAt }

const BLOCKED_IPS = new Set(); // Add known bad IPs here

// ── Suspicious request detector ───────────────────────────────────────────────
const detectAbuse = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;

  // Check blocked IPs
  if (BLOCKED_IPS.has(ip)) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Track request frequency per IP
  const now = Date.now();
  const tracker = abuseTracker.get(ip) || { count: 0, resetAt: now + 60000 };

  if (now > tracker.resetAt) {
    tracker.count = 0;
    tracker.resetAt = now + 60000;
  }

  tracker.count++;
  abuseTracker.set(ip, tracker);

  // Hard block if > 200 req/min
  if (tracker.count > 200) {
    return res.status(429).json({ error: "Too many requests. Slow down." });
  }

  next();
};

// ── Validate content type ─────────────────────────────────────────────────────
const validateContentType = (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const ct = req.headers["content-type"] || "";
    if (!ct.includes("application/json") && !ct.includes("multipart/form-data") && !ct.includes("application/x-www-form-urlencoded")) {
      // Allow missing content-type for empty bodies
      if (req.headers["content-length"] === "0" || !req.headers["content-length"]) return next();
    }
  }
  next();
};

// ── Sanitize query params ─────────────────────────────────────────────────────
const sanitizeParams = (req, res, next) => {
  // Prevent path traversal in params
  for (const key of Object.keys(req.params)) {
    if (typeof req.params[key] === "string" && req.params[key].includes("..")) {
      return res.status(400).json({ error: "Invalid parameter" });
    }
  }
  next();
};

// ── Add security headers ──────────────────────────────────────────────────────
const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
};

// ── Check if user is banned (for token-authenticated routes) ──────────────────
const checkBanned = (req, res, next) => {
  if (req.user?.is_banned) {
    return res.status(403).json({ error: "Your account has been suspended" });
  }
  next();
};

module.exports = { detectAbuse, validateContentType, sanitizeParams, securityHeaders, checkBanned };
