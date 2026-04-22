/**
 * Simple in-memory LRU cache with TTL
 * Drop-in replacement for Redis for single-server deployments
 * Replace with ioredis for multi-server deployments
 */
class Cache {
  constructor({ maxSize = 500, defaultTtl = 60 } = {}) {
    this.store = new Map();
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl; // seconds
  }

  _evict() {
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
  }

  set(key, value, ttl = this.defaultTtl) {
    this._evict();
    const expiresAt = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiresAt });
    return value;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // Move to end (LRU)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  del(key) {
    this.store.delete(key);
  }

  // Delete all keys matching pattern (supports * wildcard at end)
  delPattern(pattern) {
    const prefix = pattern.replace("*", "");
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  flush() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

const cache = new Cache({ maxSize: 1000, defaultTtl: 120 });
module.exports = cache;
