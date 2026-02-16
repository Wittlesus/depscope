'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_DIR = path.join(os.homedir(), '.depscope');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Read the cache file from disk.
 * Returns an object of { key: { value, expiresAt } }
 */
function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Write the cache object to disk.
 */
function writeCache(data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Silently fail — cache is best-effort
  }
}

/**
 * Get a cached value by key. Returns null if missing or expired.
 */
async function get(key) {
  const cache = readCache();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    // Expired — clean it up
    delete cache[key];
    writeCache(cache);
    return null;
  }
  return entry.value;
}

/**
 * Set a cached value with TTL in milliseconds.
 */
async function set(key, value, ttlMs) {
  const ttl = typeof ttlMs === 'number' ? ttlMs : DEFAULT_TTL;
  const cache = readCache();
  cache[key] = {
    value,
    expiresAt: Date.now() + ttl,
  };
  writeCache(cache);
}

/**
 * Clear all cached data.
 */
function clear() {
  writeCache({});
}

module.exports = { get, set, clear, DEFAULT_TTL, CACHE_FILE };
