'use strict';

/**
 * Calculate a 0-100 health score from an analysis result.
 *
 * Dimensions and weights per INTERFACES.md:
 *   Maintenance: 30 — active=30, stale=15, abandoned=0
 *   Popularity:  20 — >1M/wk=20, >100K=15, >10K=10, >1K=5, else=0
 *   Size:        15 — <100KB=15, <500KB=12, <1MB=8, <5MB=4, else=0
 *   Security:    25 — none=25, low=15, moderate=8, high=2, critical=0
 *   Trend:       10 — growing=10, stable=7, declining=2
 */
function calculateScore(analysisResult) {
  let score = 0;

  // Maintenance (30 points)
  if (analysisResult.maintenance) {
    const status = analysisResult.maintenance.status;
    if (status === 'active') score += 30;
    else if (status === 'stale') score += 15;
    // abandoned = 0
  }

  // Popularity (20 points)
  if (analysisResult.popularity) {
    const dl = analysisResult.popularity.weeklyDownloads || 0;
    if (dl > 1_000_000) score += 20;
    else if (dl > 100_000) score += 15;
    else if (dl > 10_000) score += 10;
    else if (dl > 1_000) score += 5;
    // else 0
  }

  // Size (15 points)
  if (analysisResult.size) {
    const bytes = analysisResult.size.unpackedSize || 0;
    if (bytes === 0) {
      // Unknown size — give partial credit
      score += 8;
    } else if (bytes < 100 * 1024) score += 15;
    else if (bytes < 500 * 1024) score += 12;
    else if (bytes < 1024 * 1024) score += 8;
    else if (bytes < 5 * 1024 * 1024) score += 4;
    // else 0
  }

  // Security (25 points)
  if (analysisResult.security) {
    const sev = analysisResult.security.severity;
    if (sev === 'none') score += 25;
    else if (sev === 'low') score += 15;
    else if (sev === 'moderate') score += 8;
    else if (sev === 'high') score += 2;
    // critical = 0
  }

  // Trend (10 points)
  if (analysisResult.popularity) {
    const trend = analysisResult.popularity.trend;
    if (trend === 'growing') score += 10;
    else if (trend === 'stable') score += 7;
    else if (trend === 'declining') score += 2;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Convert a numeric score to a letter grade.
 * A=80-100, B=60-79, C=40-59, D=20-39, F=0-19
 */
function calculateGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

/**
 * Calculate an overall project score from all dependency results.
 * Production deps weighted 1.0, dev deps weighted 0.5.
 *
 * @param {Array} results — array of analysis results for production deps
 * @param {Array} devResults — array of analysis results for dev deps
 * @returns {number} weighted average score (0-100)
 */
function calculateProjectScore(results, devResults) {
  const prodWeight = 1.0;
  const devWeight = 0.5;

  let totalWeight = 0;
  let weightedSum = 0;

  if (results && results.length > 0) {
    for (const r of results) {
      const s = typeof r.score === 'number' ? r.score : 0;
      weightedSum += s * prodWeight;
      totalWeight += prodWeight;
    }
  }

  if (devResults && devResults.length > 0) {
    for (const r of devResults) {
      const s = typeof r.score === 'number' ? r.score : 0;
      weightedSum += s * devWeight;
      totalWeight += devWeight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

module.exports = { calculateScore, calculateGrade, calculateProjectScore };
