/**
 * LocalWala – Generic App Cache (Valkey / Redis with in-memory fallback)
 * Enterprise: handles header:active, near:active, catalog:*, business:active
 * Valkey is 100% Redis-compatible (same ioredis client, free BSD-3).
 * If REDIS_URL empty or valkey/redis down → graceful fallback to Map (no crash).
 * TTLs: header 300s, near 60s, catalog/business 300s.
 */

let fallbackCache = null;
try {
  // Reuse existing headerCache Map logic as fallback (no duplication)
  fallbackCache = require('./headerCache');
} catch (_) {
  // Fallback inline Map if headerCache not present (safety)
  const _m = new Map();
  fallbackCache = {
    get: (k) => {
      const e = _m.get(k);
      if (!e) return undefined;
      if (e.expiresAt < Date.now()) { _m.delete(k); return undefined; }
      return e.value;
    },
    set: (k, v, ttlMs = 300000) => _m.set(k, { value: v, expiresAt: Date.now() + ttlMs }),
    del: (k) => _m.delete(k),
    clearByPrefix: (p) => { for (const kk of _m.keys()) if (kk.startsWith(p)) _m.delete(kk); },
    clearAll: () => _m.clear(),
  };
}

let redis = null;
let redisReady = false;

// Lazy init: only try if REDIS_URL / VALKEY_URL present
function initRedis() {
  if (redis !== null || redisReady) return redis;
  const url = process.env.REDIS_URL || process.env.VALKEY_URL || '';
  if (!url) return null;
  try {
    const IORedis = require('ioredis');
    redis = new IORedis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      retryStrategy: () => null, // fail fast, fallback to Map
    });
    redis.on('error', () => { redisReady = false; });
    redis.on('connect', () => { redisReady = true; });
    // Fire connect but don't block — fallback Map handles requests until ready
    redis.connect().catch(() => { redisReady = false; });
    return redis;
  } catch (_) {
    return null;
  }
}
initRedis();

async function get(key) {
  const r = initRedis();
  if (r && redisReady) {
    try {
      const raw = await r.get(key);
      if (raw !== null) {
        try { return JSON.parse(raw); } catch (_) { return raw; }
      }
      return undefined; // miss
    } catch (_) { /* fallback to Map */ }
  }
  return fallbackCache.get(key);
}

async function set(key, value, ttlMs = 300000) {
  const r = initRedis();
  if (r && redisReady) {
    try {
      const str = JSON.stringify(value);
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await r.setex(key, ttlSec, str);
      return;
    } catch (_) { /* fallback */ }
  }
  fallbackCache.set(key, value, ttlMs);
}

async function del(key) {
  const r = initRedis();
  if (r && redisReady) {
    try { await r.del(key); } catch (_) {}
  }
  fallbackCache.del(key);
}

async function clearByPrefix(prefix) {
  const r = initRedis();
  if (r && redisReady) {
    try {
      // Valkey/Redis SCAN for prefix (safe for large keyspace)
      let cursor = '0';
      do {
        const [next, keys] = await r.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length) await r.del(...keys);
      } while (cursor !== '0');
      return;
    } catch (_) {}
  }
  fallbackCache.clearByPrefix(prefix);
}

async function clearAll() {
  const r = initRedis();
  if (r && redisReady) {
    try { await r.flushdb(); } catch (_) {}
  }
  fallbackCache.clearAll();
}

module.exports = { get, set, del, clearByPrefix, clearAll, _fallback: fallbackCache };
