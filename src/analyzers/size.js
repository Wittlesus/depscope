'use strict';

/**
 * Analyze package size from registry metadata.
 * Extracts unpackedSize from the latest version's dist field.
 *
 * @param {object} packageInfo — full metadata from registry.npmjs.org
 * @returns {{ unpackedSize: number, unpackedSizeHuman: string }}
 */
async function analyzeSize(packageInfo) {
  if (!packageInfo) {
    return { unpackedSize: 0, unpackedSizeHuman: 'unknown' };
  }

  let unpackedSize = 0;

  // Try to get size from latest version
  const latestTag = packageInfo['dist-tags'] && packageInfo['dist-tags'].latest;
  if (latestTag && packageInfo.versions && packageInfo.versions[latestTag]) {
    const latestVersion = packageInfo.versions[latestTag];
    if (latestVersion.dist && latestVersion.dist.unpackedSize) {
      unpackedSize = latestVersion.dist.unpackedSize;
    }
  }

  return {
    unpackedSize,
    unpackedSizeHuman: formatBytes(unpackedSize),
  };
}

/**
 * Format bytes into human-readable string.
 */
function formatBytes(bytes) {
  if (bytes === 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

module.exports = { analyzeSize, formatBytes };
