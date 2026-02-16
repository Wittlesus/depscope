'use strict';

/**
 * Terminal Reporter — color-coded, scannable dependency health output.
 * Uses raw ANSI escape codes (no chalk dependency).
 */

// ── ANSI Color Codes ──────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a number with comma separators: 28000000 → "28,000,000"
 */
function formatNumber(n) {
  if (n == null) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Get color for a letter grade.
 */
function gradeColor(grade) {
  switch (grade) {
    case 'A': return c.green;
    case 'B': return c.green;
    case 'C': return c.yellow;
    case 'D': return c.red;
    case 'F': return c.red;
    default:  return c.white;
  }
}

/**
 * Get color for maintenance status.
 */
function maintenanceColor(status) {
  switch (status) {
    case 'active':    return c.green;
    case 'stale':     return c.yellow;
    case 'abandoned': return c.red;
    default:          return c.dim;
  }
}

/**
 * Get color for security status.
 */
function securityColor(severity) {
  if (!severity || severity === 'none') return c.green;
  if (severity === 'low') return c.yellow;
  return c.red;
}

/**
 * Get trend arrow.
 */
function trendIndicator(trend) {
  switch (trend) {
    case 'growing':   return c.green + '\u2191' + c.reset;   // ↑
    case 'stable':    return c.dim + '\u2192' + c.reset;     // →
    case 'declining': return c.red + '\u2193' + c.reset;     // ↓
    default:          return c.dim + '-' + c.reset;
  }
}

/**
 * Pad or truncate a string to a given width.
 */
function pad(str, width) {
  if (str.length >= width) return str.substring(0, width);
  return str + ' '.repeat(width - str.length);
}

/**
 * Create a colored grade badge: e.g., " A " on green background.
 */
function gradeBadge(grade) {
  const color = gradeColor(grade);
  return color + c.bold + grade + c.reset;
}

/**
 * Build a simple horizontal bar for score visualization.
 */
function scoreBar(score) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  let barColor;
  if (score >= 80) barColor = c.green;
  else if (score >= 60) barColor = c.green;
  else if (score >= 40) barColor = c.yellow;
  else if (score >= 20) barColor = c.red;
  else barColor = c.red;

  return barColor + '\u2588'.repeat(filled) + c.dim + '\u2591'.repeat(empty) + c.reset;
}

// ── Main Render ───────────────────────────────────────────────────────────────

/**
 * Render analysis results to the terminal.
 * @param {Object} results - Analysis results from analyzeProject()
 * @param {Object} options - CLI options
 */
function render(results, options) {
  const deps = results.dependencies || [];
  const devDeps = results.devDependencies || [];
  const showDev = options.dev && devDeps.length > 0;

  if (options.quiet) {
    renderQuiet(results, deps, devDeps, options);
    return;
  }

  // Header
  write('\n');
  write(c.bold + c.cyan + '  DepScope' + c.reset + c.dim + ' — Dependency Health Report' + c.reset + '\n');
  write(c.dim + '  ' + '\u2500'.repeat(50) + c.reset + '\n\n');

  // Production dependencies
  if (deps.length > 0) {
    write(c.bold + '  Production Dependencies' + c.reset + c.dim + ' (' + deps.length + ')' + c.reset + '\n\n');
    renderDeps(deps, options);
  }

  // Dev dependencies
  if (showDev) {
    write('\n' + c.bold + '  Dev Dependencies' + c.reset + c.dim + ' (' + devDeps.length + ')' + c.reset + '\n\n');
    renderDeps(devDeps, options);
  }

  // Summary
  write('\n');
  renderSummary(results, deps, devDeps, options);
  write('\n');
}

/**
 * Render the dependency list.
 */
function renderDeps(deps, options) {
  // Sort by score ascending (worst first)
  let sorted = deps.slice().sort(function (a, b) {
    return a.score - b.score;
  });

  // Apply limit
  if (options.limit && options.limit > 0) {
    sorted = sorted.slice(0, options.limit);
  }

  sorted.forEach(function (dep) {
    renderSingleDep(dep, options);
  });
}

/**
 * Render a single dependency entry.
 */
function renderSingleDep(dep, options) {
  const name = dep.name || 'unknown';
  const version = dep.version || '?';
  const latest = dep.latestVersion || '?';
  const score = dep.score != null ? dep.score : 0;
  const grade = dep.grade || '?';

  // Line 1: Name, version, grade, score bar
  write('  ' + gradeBadge(grade) + ' ');
  write(c.bold + pad(name, 30) + c.reset + ' ');
  write(c.dim + version + ' \u2192 ' + latest + c.reset + '\n');

  // Line 2: Details row
  write('    ');

  // Score bar
  write(scoreBar(score) + ' ' + c.bold + score + c.reset + '/100  ');

  // Maintenance
  const maint = dep.maintenance || {};
  const maintStatus = maint.status || 'unknown';
  write(maintenanceColor(maintStatus) + maintStatus + c.reset + '  ');

  // Downloads
  const pop = dep.popularity || {};
  const downloads = pop.weeklyDownloads != null ? formatNumber(pop.weeklyDownloads) : '?';
  const trend = pop.trend || 'stable';
  write(c.dim + downloads + '/wk ' + c.reset + trendIndicator(trend) + '  ');

  // Size
  const size = dep.size || {};
  const sizeStr = size.unpackedSizeHuman || '?';
  write(c.dim + sizeStr + c.reset + '  ');

  // Security
  const sec = dep.security || {};
  const vulns = sec.vulnerabilities || 0;
  const severity = sec.severity || 'none';
  if (vulns === 0) {
    write(securityColor(severity) + '\u2713 secure' + c.reset);
  } else {
    write(securityColor(severity) + '\u2717 ' + vulns + ' vuln' + (vulns > 1 ? 's' : '') + ' (' + severity + ')' + c.reset);
  }

  write('\n');

  // Line 3: Alternative suggestion (if --fix and alternative exists)
  if (options.fix && dep.alternative && dep.alternative.name) {
    write('    ' + c.magenta + '\u21B3 Consider: ' + c.bold + dep.alternative.name + c.reset);
    if (dep.alternative.reason) {
      write(c.dim + ' \u2014 ' + dep.alternative.reason + c.reset);
    }
    write('\n');
  }

  write('\n');
}

/**
 * Render the summary section at the bottom.
 */
function renderSummary(results, deps, devDeps, options) {
  const all = options.dev ? deps.concat(devDeps) : deps;
  const projectScore = results.projectScore != null ? results.projectScore : 0;
  const projectGrade = results.projectGrade || '?';

  write(c.dim + '  ' + '\u2500'.repeat(50) + c.reset + '\n\n');

  // Overall project score
  write('  ' + c.bold + 'Project Health: ' + c.reset);
  write(gradeBadge(projectGrade) + '  ');
  write(scoreBar(projectScore) + ' ' + c.bold + projectScore + c.reset + '/100\n\n');

  // Grade distribution
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let abandoned = 0;
  let vulnerable = 0;

  all.forEach(function (dep) {
    if (dep.grade && grades[dep.grade] !== undefined) {
      grades[dep.grade]++;
    }
    if (dep.maintenance && dep.maintenance.status === 'abandoned') {
      abandoned++;
    }
    if (dep.security && dep.security.vulnerabilities > 0) {
      vulnerable++;
    }
  });

  write('  ' + c.bold + 'Grades: ' + c.reset);
  write(c.green + 'A:' + grades.A + c.reset + '  ');
  write(c.green + 'B:' + grades.B + c.reset + '  ');
  write(c.yellow + 'C:' + grades.C + c.reset + '  ');
  write(c.red + 'D:' + grades.D + c.reset + '  ');
  write(c.red + 'F:' + grades.F + c.reset + '\n');

  // Counts
  write('  ' + c.bold + 'Total: ' + c.reset + all.length + ' dependencies');
  if (options.dev) {
    write(' (' + deps.length + ' prod, ' + devDeps.length + ' dev)');
  }
  write('\n');

  if (abandoned > 0) {
    write('  ' + c.red + '\u26A0 ' + abandoned + ' abandoned package' + (abandoned > 1 ? 's' : '') + c.reset + '\n');
  }

  if (vulnerable > 0) {
    write('  ' + c.red + '\u26A0 ' + vulnerable + ' package' + (vulnerable > 1 ? 's' : '') + ' with known vulnerabilities' + c.reset + '\n');
  }

  // Healthy count
  const healthy = grades.A + grades.B;
  if (healthy > 0) {
    write('  ' + c.green + '\u2713 ' + healthy + ' healthy package' + (healthy > 1 ? 's' : '') + ' (A or B)' + c.reset + '\n');
  }
}

/**
 * Render quiet/minimal output — just the score and worst offenders.
 */
function renderQuiet(results, deps, devDeps, options) {
  const all = options.dev ? deps.concat(devDeps) : deps;
  const projectScore = results.projectScore != null ? results.projectScore : 0;
  const projectGrade = results.projectGrade || '?';

  write('\n  DepScope: ' + gradeBadge(projectGrade) + ' ' + projectScore + '/100');
  write(' (' + all.length + ' deps)\n');

  // Show only D and F grades
  const bad = all
    .filter(function (d) { return d.grade === 'D' || d.grade === 'F'; })
    .sort(function (a, b) { return a.score - b.score; });

  if (options.limit && options.limit > 0) {
    bad.splice(options.limit);
  }

  if (bad.length > 0) {
    write('\n  Issues:\n');
    bad.forEach(function (dep) {
      write('  ' + gradeBadge(dep.grade) + ' ' + dep.name);
      if (dep.maintenance && dep.maintenance.status === 'abandoned') {
        write(c.red + ' (abandoned)' + c.reset);
      }
      if (dep.security && dep.security.vulnerabilities > 0) {
        write(c.red + ' (' + dep.security.vulnerabilities + ' vulns)' + c.reset);
      }
      write('\n');
    });
  }

  write('\n');
}

/**
 * Helper to write to stdout.
 */
function write(str) {
  process.stdout.write(str);
}

module.exports = { render };
