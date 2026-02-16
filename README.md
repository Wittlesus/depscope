# DepScope

**Your `package.json` has 47 dependencies. How many are abandoned?**

DepScope is a zero-config CLI that scans your npm dependencies and gives each one a health score based on maintenance activity, download trends, bundle size, and known vulnerabilities. Find the dead weight before it finds you.

```
npx depscope
```

## What It Checks

DepScope evaluates every dependency across **5 dimensions**:

| Dimension | What it measures |
|-----------|-----------------|
| **Maintenance** | When was the last publish? Active, stale, or abandoned? |
| **Popularity** | Weekly download count and trend direction |
| **Size** | Unpacked size — catch the bloat before it ships |
| **Security** | Known CVEs and vulnerability severity |
| **Trend** | Is usage growing, stable, or declining? |

Each dependency gets a **0-100 health score** and a letter grade.

## Example Output

```
  DepScope — Dependency Health Report
  ──────────────────────────────────────────────────────

  Production Dependencies (6)

  A express                       ^4.21.0 → 4.21.0
    ████████████████████░░░░ 85/100  active  28,000,000/wk ↑  209 KB  ✓ secure

  A fastify                       ^5.2.1 → 5.2.1
    ██████████████████████░░ 92/100  active  4,200,000/wk ↑  312 KB  ✓ secure

  B lodash                        ^4.17.21 → 4.17.21
    ████████████████░░░░░░░░ 68/100  stale   51,000,000/wk →  1.4 MB  ✓ secure

  C moment                        ^2.30.1 → 2.30.1
    ██████████░░░░░░░░░░░░░░ 42/100  abandoned  12,500,000/wk ↓  4.2 MB  ✓ secure
    ↳ Consider: dayjs — 2KB, same API, actively maintained

  D request                       ^2.88.2 → 2.88.2
    ██████░░░░░░░░░░░░░░░░░░ 22/100  abandoned  5,800,000/wk ↓  1.1 MB  ✗ 3 vulns (high)
    ↳ Consider: undici — Built into Node.js, modern HTTP client

  F event-stream                  ^4.0.1 → 4.0.1
    ██░░░░░░░░░░░░░░░░░░░░░░ 8/100   abandoned  320,000/wk ↓  45 KB  ✗ 1 vuln (critical)

  ──────────────────────────────────────────────────────

  Project Health: B  ████████████████░░░░░░░░ 64/100

  Grades: A:2  B:1  C:1  D:1  F:1
  Total: 6 dependencies
  ⚠ 3 abandoned packages
  ⚠ 2 packages with known vulnerabilities
  ✓ 3 healthy packages (A or B)
```

## Health Score

Each dependency is scored on a 100-point scale:

| Dimension | Weight | Scoring |
|-----------|--------|---------|
| Maintenance | 30pts | active=30, stale=15, abandoned=0 |
| Popularity | 20pts | >1M/wk=20, >100K=15, >10K=10, >1K=5, else=0 |
| Size | 15pts | <100KB=15, <500KB=12, <1MB=8, <5MB=4, else=0 |
| Security | 25pts | clean=25, low=15, moderate=8, high=2, critical=0 |
| Trend | 10pts | growing=10, stable=7, declining=2 |

### Grades

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 80-100 | Healthy — well-maintained, popular, secure |
| **B** | 60-79 | Good — minor concerns, generally fine |
| **C** | 40-59 | Fair — some red flags, review recommended |
| **D** | 20-39 | Poor — significant issues, consider replacing |
| **F** | 0-19 | Critical — abandoned, vulnerable, or both |

## CLI Reference

```
depscope [path] [options]
```

### Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `path` | Path to project directory | Current directory |

### Options

| Flag | Description |
|------|-------------|
| `--json` | Output results as JSON (for CI/CD piping) |
| `--dev` | Include devDependencies in analysis |
| `--fix` | Show alternative package suggestions |
| `--no-cache` | Skip cache, make fresh API calls |
| `--quiet` | Minimal output — just score and issues |
| `--limit <n>` | Only show the N worst-scoring dependencies |
| `-v, --version` | Show version number |
| `-h, --help` | Show help |

### Examples

```bash
# Scan current project
npx depscope

# Scan a specific project
npx depscope ./my-project

# JSON output for CI
npx depscope --json

# Show everything including dev dependencies
npx depscope --dev

# Find the 5 worst dependencies with fix suggestions
npx depscope --fix --limit 5

# Quick health check
depscope --quiet
```

### CI/CD Integration

DepScope exits with code 1 if any dependency has an F grade, making it easy to integrate into CI pipelines:

```yaml
# GitHub Actions
- name: Check dependency health
  run: npx depscope --json > depscope-report.json
```

```bash
# Parse with jq
npx depscope --json | jq '.dependencies[] | select(.grade == "F") | .name'
```

## Alternatives Database

When you use the `--fix` flag, DepScope suggests modern alternatives for problematic packages. The curated database covers common migrations like:

- `moment` -> `dayjs` (2KB, same API)
- `request` -> `undici` (built into Node.js)
- `lodash` -> native ES6+ methods
- `chalk` -> built-in ANSI codes
- And many more

## Requirements

- Node.js 18 or later (uses built-in `fetch()`)
- A `package.json` file to scan

## Related Tools

- **[RulesForge](https://github.com/Wittlesus/rulesforge)** — Using AI coding tools? Generate better rules for Cursor, Copilot, and Claude Code.
- **[ScopeGuard](https://github.com/Wittlesus/scopeguard)** — Prevent AI scope creep with automated boundary enforcement.

## License

MIT - Copyright 2026 [Wittlesus](https://github.com/Wittlesus)
