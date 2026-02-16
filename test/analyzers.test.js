'use strict';

const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');

// ─────────────────────────────────────────────────────────
// Score tests (pure functions, no mocking needed)
// ─────────────────────────────────────────────────────────

const { calculateScore, calculateGrade, calculateProjectScore } = require('../src/lib/score');

describe('calculateScore', () => {
  it('should return 100 for a perfect package', () => {
    const result = {
      maintenance: { status: 'active' },          // 30
      popularity: { weeklyDownloads: 2_000_000, trend: 'growing' }, // 20 + 10
      size: { unpackedSize: 50_000 },              // 15
      security: { severity: 'none' },              // 25
    };
    assert.equal(calculateScore(result), 100);
  });

  it('should return 0 for the worst possible package', () => {
    const result = {
      maintenance: { status: 'abandoned' },        // 0
      popularity: { weeklyDownloads: 50, trend: 'declining' }, // 0 + 2
      size: { unpackedSize: 10_000_000 },          // 0
      security: { severity: 'critical' },          // 0
    };
    assert.equal(calculateScore(result), 2);
  });

  it('should handle stale + moderate + stable scenario', () => {
    const result = {
      maintenance: { status: 'stale' },            // 15
      popularity: { weeklyDownloads: 50_000, trend: 'stable' }, // 10 + 7
      size: { unpackedSize: 200_000 },             // 12
      security: { severity: 'moderate' },          // 8
    };
    assert.equal(calculateScore(result), 52);
  });

  it('should handle missing fields gracefully', () => {
    const result = {};
    assert.equal(calculateScore(result), 0);
  });
});

describe('calculateGrade', () => {
  it('should return A for scores 80-100', () => {
    assert.equal(calculateGrade(80), 'A');
    assert.equal(calculateGrade(100), 'A');
    assert.equal(calculateGrade(90), 'A');
  });

  it('should return B for scores 60-79', () => {
    assert.equal(calculateGrade(60), 'B');
    assert.equal(calculateGrade(79), 'B');
  });

  it('should return C for scores 40-59', () => {
    assert.equal(calculateGrade(40), 'C');
    assert.equal(calculateGrade(59), 'C');
  });

  it('should return D for scores 20-39', () => {
    assert.equal(calculateGrade(20), 'D');
    assert.equal(calculateGrade(39), 'D');
  });

  it('should return F for scores 0-19', () => {
    assert.equal(calculateGrade(0), 'F');
    assert.equal(calculateGrade(19), 'F');
  });
});

describe('calculateProjectScore', () => {
  it('should calculate weighted average of prod and dev deps', () => {
    const prod = [{ score: 80 }, { score: 60 }]; // avg 70 * weight 1.0
    const dev = [{ score: 40 }];                  // 40 * weight 0.5
    // total = (80 + 60 + 20) / (1 + 1 + 0.5) = 160/2.5 = 64
    assert.equal(calculateProjectScore(prod, dev), 64);
  });

  it('should handle prod-only (no dev deps)', () => {
    const prod = [{ score: 90 }, { score: 70 }];
    assert.equal(calculateProjectScore(prod, []), 80);
  });

  it('should return 0 for no deps', () => {
    assert.equal(calculateProjectScore([], []), 0);
  });
});

// ─────────────────────────────────────────────────────────
// Alternatives tests (sync, no API calls)
// ─────────────────────────────────────────────────────────

const { getAlternative } = require('../src/analyzers/alternatives');

describe('getAlternative', () => {
  it('should return alternative for moment', () => {
    const alt = getAlternative('moment');
    assert.ok(alt);
    assert.equal(alt.name, 'date-fns');
    assert.ok(alt.reason.length > 0);
  });

  it('should return alternative for lodash', () => {
    const alt = getAlternative('lodash');
    assert.ok(alt);
    assert.equal(alt.name, 'es-toolkit');
  });

  it('should return alternative for request', () => {
    const alt = getAlternative('request');
    assert.ok(alt);
    assert.equal(alt.name, 'got');
  });

  it('should return null for unknown package', () => {
    const alt = getAlternative('some-totally-unknown-package-xyz');
    assert.equal(alt, null);
  });

  it('should return alternative for chalk', () => {
    const alt = getAlternative('chalk');
    assert.ok(alt);
    assert.equal(alt.name, 'picocolors');
  });
});

// ─────────────────────────────────────────────────────────
// Maintenance analyzer tests (uses mock data, no API calls)
// ─────────────────────────────────────────────────────────

const { analyzeMaintenance } = require('../src/analyzers/maintenance');

describe('analyzeMaintenance', () => {
  it('should detect active package (published recently)', async () => {
    const now = new Date();
    const recentDate = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const packageInfo = {
      'dist-tags': { latest: '1.0.0' },
      time: { '1.0.0': recentDate.toISOString() },
    };
    const result = await analyzeMaintenance(packageInfo);
    assert.equal(result.status, 'active');
    assert.ok(result.daysSincePublish < 180);
  });

  it('should detect stale package (published 12 months ago)', async () => {
    const now = new Date();
    const staleDate = new Date(now - 365 * 24 * 60 * 60 * 1000); // 12 months ago
    const packageInfo = {
      'dist-tags': { latest: '2.0.0' },
      time: { '2.0.0': staleDate.toISOString() },
    };
    const result = await analyzeMaintenance(packageInfo);
    assert.equal(result.status, 'stale');
    assert.ok(result.daysSincePublish >= 180);
    assert.ok(result.daysSincePublish < 540);
  });

  it('should detect abandoned package (published 2+ years ago)', async () => {
    const now = new Date();
    const oldDate = new Date(now - 800 * 24 * 60 * 60 * 1000); // ~2.2 years ago
    const packageInfo = {
      'dist-tags': { latest: '0.1.0' },
      time: { '0.1.0': oldDate.toISOString() },
    };
    const result = await analyzeMaintenance(packageInfo);
    assert.equal(result.status, 'abandoned');
    assert.ok(result.daysSincePublish >= 540);
  });

  it('should handle missing packageInfo gracefully', async () => {
    const result = await analyzeMaintenance(null);
    assert.equal(result.status, 'abandoned');
  });
});

// ─────────────────────────────────────────────────────────
// Size analyzer tests (uses mock data, no API calls)
// ─────────────────────────────────────────────────────────

const { analyzeSize, formatBytes } = require('../src/analyzers/size');

describe('analyzeSize', () => {
  it('should extract size from package metadata', async () => {
    const packageInfo = {
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          dist: { unpackedSize: 214000 },
        },
      },
    };
    const result = await analyzeSize(packageInfo);
    assert.equal(result.unpackedSize, 214000);
    assert.equal(result.unpackedSizeHuman, '209 KB');
  });

  it('should handle missing size data', async () => {
    const result = await analyzeSize({});
    assert.equal(result.unpackedSize, 0);
    assert.equal(result.unpackedSizeHuman, 'unknown');
  });
});

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    assert.equal(formatBytes(0), 'unknown');
    assert.equal(formatBytes(500), '500 B');
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(1536), '2 KB');
    assert.equal(formatBytes(1048576), '1.0 MB');
    assert.equal(formatBytes(5242880), '5.0 MB');
  });
});

// ─────────────────────────────────────────────────────────
// Security analyzer tests (MVP: always returns clean)
// ─────────────────────────────────────────────────────────

const { analyzeSecurity } = require('../src/analyzers/security');

describe('analyzeSecurity', () => {
  it('should return clean security report (MVP)', async () => {
    const result = await analyzeSecurity('express', '^4.21.0');
    assert.equal(result.vulnerabilities, 0);
    assert.equal(result.severity, 'none');
  });
});

// ─────────────────────────────────────────────────────────
// Cache tests
// ─────────────────────────────────────────────────────────

const cacheModule = require('../src/lib/cache');

describe('cache', () => {
  before(() => {
    cacheModule.clear();
  });

  after(() => {
    cacheModule.clear();
  });

  it('should return null for missing keys', async () => {
    const val = await cacheModule.get('nonexistent-key');
    assert.equal(val, null);
  });

  it('should store and retrieve values', async () => {
    await cacheModule.set('test-key', { foo: 'bar' }, 60000);
    const val = await cacheModule.get('test-key');
    assert.deepEqual(val, { foo: 'bar' });
  });

  it('should return null for expired entries', async () => {
    await cacheModule.set('expired-key', 'value', 1); // 1ms TTL
    // Wait a bit for it to expire
    await new Promise(resolve => setTimeout(resolve, 10));
    const val = await cacheModule.get('expired-key');
    assert.equal(val, null);
  });

  it('should clear all cache', async () => {
    await cacheModule.set('a', 1, 60000);
    await cacheModule.set('b', 2, 60000);
    cacheModule.clear();
    const a = await cacheModule.get('a');
    const b = await cacheModule.get('b');
    assert.equal(a, null);
    assert.equal(b, null);
  });
});
