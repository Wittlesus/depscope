'use strict';

const npmApi = require('../lib/npm-api');

/**
 * Analyze popularity of a package via download counts and trends.
 *
 * @param {string} name — package name
 * @returns {{ weeklyDownloads: number, trend: string, trendPercent: number }}
 */
async function analyzePopularity(name) {
  // Fetch weekly downloads and trend in parallel
  const [weeklyData, trendData] = await Promise.all([
    npmApi.getWeeklyDownloads(name),
    npmApi.getDownloadTrend(name),
  ]);

  const weeklyDownloads = (weeklyData && weeklyData.downloads) || 0;

  let trend = 'stable';
  let trendPercent = 0;

  if (trendData) {
    trend = trendData.trend;
    trendPercent = trendData.percent;
  }

  return { weeklyDownloads, trend, trendPercent };
}

module.exports = { analyzePopularity };
