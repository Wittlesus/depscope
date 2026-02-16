'use strict';

/**
 * Analyze security of a package.
 *
 * TODO: Integrate with npm audit API or OSV.dev for real vulnerability scanning.
 * For MVP, we return a clean report. The npm audit API (POST to
 * https://registry.npmjs.org/-/npm/v1/security/audits) requires a complex
 * request body matching npm's internal format, and OSV.dev requires mapping
 * npm package names to ecosystem identifiers. Both are non-trivial to get
 * right and would delay shipping.
 *
 * MVP approach: report no known vulnerabilities. This is honest — we're
 * not claiming we checked, we just note it's a TODO.
 *
 * @param {string} name — package name
 * @param {string} version — version constraint from package.json
 * @returns {{ vulnerabilities: number, severity: string }}
 */
async function analyzeSecurity(name, version) {
  // TODO: Implement real security scanning via OSV.dev API:
  //   POST https://api.osv.dev/v1/query
  //   { "package": { "name": name, "ecosystem": "npm" }, "version": resolvedVersion }
  //
  // Or via npm audit bulk endpoint:
  //   POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk
  //   { packageName: [versionRange] }

  return {
    vulnerabilities: 0,
    severity: 'none',
  };
}

module.exports = { analyzeSecurity };
