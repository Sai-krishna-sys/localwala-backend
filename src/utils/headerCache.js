/**
 * LocalWala – In-Memory Header Cache (TTL-based)
 * Enterprise: prevents MongoDB hit on every GET /public/dynamic_header
 * TTL 5 min (300s) + immediate invalidation on CUD.
 * Falls back gracefully when Redis not available — pure Node Map, no dep.
 * For horizontal scale, replace with Redis (same API: get/set/del/clear).
 */

const cache = new Map(); // key -> { value, expiresAt }

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

function now() {
  return Date.now();
}

function get(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs = TTL_MS) {
  cache.set(key, { value, expiresAt: now() + ttlMs });
}

function del(key) {
  cache.delete(key);
}

function clearByPrefix(prefix) {
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

function clearAll() {
  cache.clear();
}

// Periodic cleanup of expired keys (prevents memory leak)
let cleanupTimer = null;
function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const t = now();
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt < t) cache.delete(k);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't block process exit
  if (cleanupTimer.unref) cleanupTimer.unref();
}

startCleanup();

module.exports = { get, set, del, clearByPrefix, clearAll, TTL_MS };
