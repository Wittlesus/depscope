'use strict';

const cache = require('./cache');

const REGISTRY_URL = 'https://registry.npmjs.org';
const DOWNLOADS_URL = 'https://api.npmjs.org/downloads';
const TIMEOUT_MS = 10000;
const CACHE_TTL = cache.DEFAULT_TTL; // 1 hour

/**
 * Fetch with timeout using AbortController.
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch with caching layer. Returns parsed JSON or null on failure.
 */
async function cachedFetch(url, cacheKey) {
  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetchWithTimeout(url);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    await cache.set(cacheKey, data, CACHE_TTL);
    return data;
  } catch (err) {
    // Network error, timeout, etc. — return null gracefully
    return null;
  }
}

/**
 * Get full package metadata from the npm registry.
 * @param {string} name — package name (e.g. "express")
 * @returns {object|null} — registry JSON or null if not found / error
 */
async function getPackageInfo(name) {
  const url = `${REGISTRY_URL}/${encodeURIComponent(name)}`;
  const cacheKey = `pkg:${name}`;
  return cachedFetch(url, cacheKey);
}

/**
 * Get weekly download count for a package.
 * @param {string} name — package name
 * @returns {{ downloads: number }|null}
 */
async function getWeeklyDownloads(name) {
  const url = `${DOWNLOADS_URL}/point/last-week/${encodeURIComponent(name)}`;
  const cacheKey = `dl-week:${name}`;
  return cachedFetch(url, cacheKey);
}

/**
 * Get download trend — compare recent week vs ~6 months ago.
 * Uses the range API to get weekly data for the last year,
 * then compares the most recent week to the week ~26 weeks ago.
 * @param {string} name — package name
 * @returns {{ recent: number, sixMonthsAgo: number, trend: string, percent: number }|null}
 */
async function getDownloadTrend(name) {
  const url = `${DOWNLOADS_URL}/range/last-year/${encodeURIComponent(name)}`;
  const cacheKey = `dl-trend:${name}`;
  const data = await cachedFetch(url, cacheKey);
  if (!data || !data.downloads || !Array.isArray(data.downloads)) {
    return null;
  }

  const downloads = data.downloads; // array of { day, downloads }

  // Get recent 7 days total
  const recentDays = downloads.slice(-7);
  const recent = recentDays.reduce((sum, d) => sum + d.downloads, 0);

  // Get 7 days from ~6 months ago (offset by ~182 days)
  const sixMonthOffset = Math.max(0, downloads.length - 182 - 7);
  const oldDays = downloads.slice(sixMonthOffset, sixMonthOffset + 7);
  const sixMonthsAgo = oldDays.reduce((sum, d) => sum + d.downloads, 0);

  // Calculate trend
  let trend = 'stable';
  let percent = 0;

  if (sixMonthsAgo > 0) {
    percent = ((recent - sixMonthsAgo) / sixMonthsAgo) * 100;
    percent = Math.round(percent * 10) / 10; // 1 decimal
    if (percent > 10) trend = 'growing';
    else if (percent < -10) trend = 'declining';
  } else if (recent > 0) {
    trend = 'growing';
    percent = 100;
  }

  return { recent, sixMonthsAgo, trend, percent };
}

module.exports = { getPackageInfo, getWeeklyDownloads, getDownloadTrend };
