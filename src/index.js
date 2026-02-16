'use strict';

const npmApi = require('./lib/npm-api');
const cache = require('./lib/cache');
const { calculateScore, calculateGrade, calculateProjectScore } = require('./lib/score');
const { analyzeMaintenance } = require('./analyzers/maintenance');
const { analyzePopularity } = require('./analyzers/popularity');
const { analyzeSize } = require('./analyzers/size');
const { analyzeSecurity } = require('./analyzers/security');
const { getAlternative } = require('./analyzers/alternatives');

/**
 * Analyze a single package — runs all analyzers concurrently.
 *
 * @param {string} name — package name
 * @param {string} version — version constraint from package.json (e.g. "^4.21.0")
 * @param {object} [options] — { noCache: boolean }
 * @returns {object} — full analysis result per INTERFACES.md shape
 */
async function analyzePackage(name, version, options = {}) {
  // Clear cache for this run if requested
  // (cache module handles per-key TTL, so we just skip reading from it by clearing first)
  // Actually, the cache module is used internally by npm-api; for noCache we need a different approach.
  // For now, we'll clear all cache if noCache is set — acceptable for MVP.
  if (options.noCache) {
    cache.clear();
  }

  // Fetch package metadata
  const packageInfo = await npmApi.getPackageInfo(name);

  if (!packageInfo) {
    // Package not found or network error
    return {
      name,
      version,
      latestVersion: 'unknown',
      maintenance: { lastPublish: 'unknown', daysSincePublish: Infinity, status: 'abandoned' },
      popularity: { weeklyDownloads: 0, trend: 'stable', trendPercent: 0 },
      size: { unpackedSize: 0, unpackedSizeHuman: 'unknown' },
      security: { vulnerabilities: 0, severity: 'none' },
      alternative: getAlternative(name),
      score: 0,
      grade: 'F',
      error: 'Package not found or network error',
    };
  }

  const latestVersion = (packageInfo['dist-tags'] && packageInfo['dist-tags'].latest) || 'unknown';

  // Run all analyzers concurrently
  const results = await Promise.allSettled([
    analyzeMaintenance(packageInfo),
    analyzePopularity(name),
    analyzeSize(packageInfo),
    analyzeSecurity(name, version),
  ]);

  // Extract results, using defaults for any that failed
  const maintenance = results[0].status === 'fulfilled'
    ? results[0].value
    : { lastPublish: 'unknown', daysSincePublish: Infinity, status: 'abandoned' };

  const popularity = results[1].status === 'fulfilled'
    ? results[1].value
    : { weeklyDownloads: 0, trend: 'stable', trendPercent: 0 };

  const size = results[2].status === 'fulfilled'
    ? results[2].value
    : { unpackedSize: 0, unpackedSizeHuman: 'unknown' };

  const security = results[3].status === 'fulfilled'
    ? results[3].value
    : { vulnerabilities: 0, severity: 'none' };

  const alternative = getAlternative(name);

  // Build the analysis result
  const analysisResult = {
    name,
    version,
    latestVersion,
    maintenance,
    popularity,
    size,
    security,
    alternative,
  };

  // Calculate score and grade
  analysisResult.score = calculateScore(analysisResult);
  analysisResult.grade = calculateGrade(analysisResult.score);

  return analysisResult;
}

/**
 * Analyze an entire project from its parsed package.json object.
 *
 * @param {object} pkg — parsed package.json object
 * @param {object} [options] — { includeDev: boolean, useCache: boolean }
 * @returns {{ dependencies: Array, devDependencies: Array, projectScore: number, projectGrade: string }}
 */
async function analyzeProject(pkg, options = {}) {
  const includeDev = options.includeDev || false;
  const noCache = options.useCache === false;

  const deps = pkg.dependencies || {};
  const devDeps = includeDev ? (pkg.devDependencies || {}) : {};

  const analyzeOpts = { noCache };

  // Analyze production dependencies concurrently
  const prodEntries = Object.entries(deps);
  const prodPromises = prodEntries.map(([name, version]) =>
    analyzePackage(name, version, analyzeOpts)
  );
  const prodSettled = await Promise.allSettled(prodPromises);
  const dependencies = prodSettled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      name: prodEntries[i][0],
      version: prodEntries[i][1],
      error: r.reason ? r.reason.message : 'Analysis failed',
      score: 0,
      grade: 'F',
    };
  });

  // Analyze dev dependencies concurrently
  let devDependencies = [];
  if (includeDev) {
    const devEntries = Object.entries(devDeps);
    const devPromises = devEntries.map(([name, version]) =>
      analyzePackage(name, version, analyzeOpts)
    );
    const devSettled = await Promise.allSettled(devPromises);
    devDependencies = devSettled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        name: devEntries[i][0],
        version: devEntries[i][1],
        error: r.reason ? r.reason.message : 'Analysis failed',
        score: 0,
        grade: 'F',
      };
    });
  }

  // Calculate project-level score
  const projectScore = calculateProjectScore(dependencies, devDependencies);
  const projectGrade = calculateGrade(projectScore);

  return {
    dependencies,
    devDependencies,
    projectScore,
    projectGrade,
  };
}

module.exports = { analyzePackage, analyzeProject };
