'use strict';

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');

// ── Try to load the analysis engine ──────────────────────────────────────────
// src/index.js is built by the other agent. Gracefully handle if missing.

let analyzeProject;
try {
  const engine = require('./index');
  analyzeProject = engine.analyzeProject;
} catch (err) {
  analyzeProject = null;
}

// ── Reporters ────────────────────────────────────────────────────────────────

const terminalReporter = require('./reporters/terminal');
const jsonReporter = require('./reporters/json');

// ── ANSI helpers (minimal, no chalk) ─────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// ── Spinner ──────────────────────────────────────────────────────────────────

const spinnerFrames = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

function createSpinner(message) {
  let i = 0;
  let interval = null;

  return {
    start: function () {
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?25l'); // hide cursor
        interval = setInterval(function () {
          const frame = spinnerFrames[i % spinnerFrames.length];
          process.stdout.write('\r  ' + c.cyan + frame + c.reset + ' ' + message);
          i++;
        }, 80);
      } else {
        process.stdout.write('  ' + message + '...\n');
      }
    },
    stop: function (finalMessage) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (process.stdout.isTTY) {
        process.stdout.write('\r\x1b[2K'); // clear line
        process.stdout.write('\x1b[?25h'); // show cursor
      }
      if (finalMessage) {
        process.stdout.write('  ' + finalMessage + '\n');
      }
    },
  };
}

// ── CLI Program ──────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('depscope')
  .description('Health check for your npm dependencies — find abandoned, bloated, and declining packages')
  .version(getVersion(), '-v, --version')
  .argument('[path]', 'path to project directory (default: current directory)', '.')
  .option('--json', 'output results as JSON')
  .option('--dev', 'include devDependencies in analysis')
  .option('--fix', 'show alternative package suggestions')
  .option('--no-cache', 'skip cache, make fresh API calls')
  .option('--quiet', 'minimal output (score + issues only)')
  .option('--limit <n>', 'only show the N worst-scoring dependencies', parseInt)
  .action(run);

program.parse(process.argv);

// ── Main Action ──────────────────────────────────────────────────────────────

async function run(targetPath, options) {
  try {
    // Resolve target directory
    const projectDir = path.resolve(targetPath);
    const pkgPath = path.join(projectDir, 'package.json');

    // Check that package.json exists
    if (!fs.existsSync(pkgPath)) {
      error('No package.json found at: ' + pkgPath);
      error('Run depscope in a directory with a package.json, or pass the path as an argument.');
      process.exit(1);
    }

    // Read and parse package.json
    let pkg;
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      pkg = JSON.parse(raw);
    } catch (parseErr) {
      error('Failed to parse package.json: ' + parseErr.message);
      process.exit(1);
    }

    // Check for dependencies
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const depCount = Object.keys(deps).length;
    const devDepCount = Object.keys(devDeps).length;

    if (depCount === 0 && (!options.dev || devDepCount === 0)) {
      error('No dependencies found in package.json.');
      if (devDepCount > 0 && !options.dev) {
        info('Found ' + devDepCount + ' devDependencies. Use --dev to include them.');
      }
      process.exit(1);
    }

    // Check that the analysis engine is available
    if (!analyzeProject) {
      error('Analysis engine not found (src/index.js).');
      error('This module is built by the core analysis agent. Ensure all source files are present.');
      process.exit(1);
    }

    // Show what we're scanning
    if (!options.quiet && !options.json) {
      const name = pkg.name || path.basename(projectDir);
      const totalCount = depCount + (options.dev ? devDepCount : 0);
      process.stdout.write('\n  ' + c.bold + 'Scanning ' + c.cyan + name + c.reset + c.bold + ' (' + totalCount + ' dependencies)' + c.reset + '\n');
    }

    // Start spinner
    const spinner = (!options.quiet && !options.json) ? createSpinner('Analyzing dependencies...') : null;
    if (spinner) spinner.start();

    // Run analysis
    let rawResults;
    try {
      rawResults = await analyzeProject(pkg, {
        includeDev: options.dev || false,
        dev: options.dev || false, // index.js also checks options.dev
        useCache: options.cache !== false,
      });
    } catch (analysisErr) {
      if (spinner) spinner.stop();
      handleAnalysisError(analysisErr);
      process.exit(1);
    }

    // Normalize result shape — index.js may return { results, devResults }
    // or { dependencies, devDependencies }. Handle both.
    const results = {
      dependencies: rawResults.dependencies || rawResults.results || [],
      devDependencies: rawResults.devDependencies || rawResults.devResults || [],
      projectScore: rawResults.projectScore || 0,
      projectGrade: rawResults.projectGrade || 'F',
    };

    if (spinner) {
      const depTotal = results.dependencies.length
        + (options.dev ? results.devDependencies.length : 0);
      spinner.stop(c.green + '\u2713' + c.reset + ' Analysis complete (' + depTotal + ' packages scanned)');
    }

    // Route to reporter
    const reporter = options.json ? jsonReporter : terminalReporter;
    reporter.render(results, {
      dev: options.dev || false,
      fix: options.fix || false,
      limit: options.limit || 0,
      quiet: options.quiet || false,
      noCache: options.cache === false,
    });

    // Exit code: non-zero if any F-grade dependencies
    const allDeps = results.dependencies.concat(
      options.dev ? results.devDependencies : []
    );
    const hasF = allDeps.some(function (d) { return d.grade === 'F'; });
    if (hasF) {
      process.exit(1);
    }

  } catch (err) {
    error('Unexpected error: ' + err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getVersion() {
  try {
    const pkg = require('../package.json');
    return pkg.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

function error(msg) {
  process.stderr.write(c.red + '  \u2717 ' + c.reset + msg + '\n');
}

function info(msg) {
  process.stderr.write(c.dim + '  \u2139 ' + c.reset + msg + '\n');
}

function handleAnalysisError(err) {
  const msg = err.message || String(err);

  if (msg.includes('fetch') || msg.includes('network') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
    error('Network error — could not reach npm registry.');
    error('Check your internet connection and try again.');
    info('Use --no-cache to bypass cached results.');
  } else if (msg.includes('rate limit') || msg.includes('429')) {
    error('Rate limited by npm registry.');
    info('Wait a minute and try again, or use cached results (default).');
  } else {
    error('Analysis failed: ' + msg);
  }
}
