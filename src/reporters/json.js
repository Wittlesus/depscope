'use strict';

/**
 * JSON Reporter — outputs analysis results as clean JSON to stdout.
 * Suitable for CI/CD piping, programmatic consumption, and jq filtering.
 */

/**
 * Render results as JSON to stdout.
 * @param {Object} results - Analysis results from analyzeProject()
 * @param {Object} options - CLI options
 * @param {boolean} options.dev - Whether devDependencies were included
 * @param {boolean} options.fix - Whether to include alternatives
 * @param {number} options.limit - Limit number of results (0 = all)
 * @param {boolean} options.quiet - Minimal output
 */
function render(results, options) {
  const output = buildOutput(results, options);
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

/**
 * Build the output object from results.
 */
function buildOutput(results, options) {
  const deps = results.dependencies || [];
  const devDeps = results.devDependencies || [];

  let allDeps = deps.map(function (d) {
    return formatDep(d, 'production', options);
  });

  if (options.dev && devDeps.length > 0) {
    allDeps = allDeps.concat(
      devDeps.map(function (d) {
        return formatDep(d, 'dev', options);
      })
    );
  }

  // Sort by score ascending (worst first) for limit
  allDeps.sort(function (a, b) {
    return a.score - b.score;
  });

  if (options.limit && options.limit > 0) {
    allDeps = allDeps.slice(0, options.limit);
  }

  const output = {
    projectScore: results.projectScore || 0,
    projectGrade: results.projectGrade || 'F',
    totalDependencies: deps.length + (options.dev ? devDeps.length : 0),
    scannedAt: new Date().toISOString(),
    dependencies: allDeps,
  };

  if (!options.quiet) {
    output.summary = buildSummary(deps, devDeps, options);
  }

  return output;
}

/**
 * Format a single dependency for JSON output.
 */
function formatDep(dep, type, options) {
  const entry = {
    name: dep.name,
    type: type,
    version: dep.version,
    latestVersion: dep.latestVersion,
    score: dep.score,
    grade: dep.grade,
    maintenance: dep.maintenance,
    popularity: dep.popularity,
    size: dep.size,
    security: dep.security,
  };

  if (options.fix && dep.alternative && dep.alternative.name) {
    entry.alternative = dep.alternative;
  }

  return entry;
}

/**
 * Build a summary object.
 */
function buildSummary(deps, devDeps, options) {
  const all = options.dev ? deps.concat(devDeps) : deps;

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

  return {
    grades: grades,
    abandonedCount: abandoned,
    vulnerableCount: vulnerable,
    productionCount: deps.length,
    devCount: options.dev ? devDeps.length : 0,
  };
}

module.exports = { render };
