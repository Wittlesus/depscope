'use strict';

/**
 * Analyze maintenance health of a package.
 * Uses the "time" field from registry metadata to determine last publish date.
 *
 * @param {object} packageInfo — full metadata from registry.npmjs.org
 * @returns {{ lastPublish: string, daysSincePublish: number, status: string }}
 */
async function analyzeMaintenance(packageInfo) {
  if (!packageInfo || !packageInfo.time) {
    return {
      lastPublish: 'unknown',
      daysSincePublish: Infinity,
      status: 'abandoned',
    };
  }

  // Find the latest publish date from the "time" field
  // "time" is an object like { "created": "...", "modified": "...", "1.0.0": "...", ... }
  const latestTag = packageInfo['dist-tags'] && packageInfo['dist-tags'].latest;
  let lastPublishDate;

  if (latestTag && packageInfo.time[latestTag]) {
    lastPublishDate = new Date(packageInfo.time[latestTag]);
  } else if (packageInfo.time.modified) {
    lastPublishDate = new Date(packageInfo.time.modified);
  } else {
    // Fallback: find the most recent date in the time object
    let latest = null;
    for (const [key, val] of Object.entries(packageInfo.time)) {
      if (key === 'created') continue;
      const d = new Date(val);
      if (!latest || d > latest) latest = d;
    }
    lastPublishDate = latest || new Date(0);
  }

  const now = new Date();
  const diffMs = now - lastPublishDate;
  const daysSincePublish = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Determine status
  const sixMonthsDays = 180; // ~6 months
  const eighteenMonthsDays = 540; // ~18 months
  let status;
  if (daysSincePublish < sixMonthsDays) {
    status = 'active';
  } else if (daysSincePublish < eighteenMonthsDays) {
    status = 'stale';
  } else {
    status = 'abandoned';
  }

  // Format date as ISO date string (YYYY-MM-DD)
  const lastPublish = lastPublishDate.toISOString().split('T')[0];

  return { lastPublish, daysSincePublish, status };
}

module.exports = { analyzeMaintenance };
