'use strict';

const path = require('path');

// Load the curated alternatives database
const alternatives = require(path.join(__dirname, '..', 'data', 'alternatives.json'));

/**
 * Look up a curated alternative for a given package.
 * Synchronous — reads from the bundled JSON database.
 *
 * @param {string} name — package name
 * @returns {{ name: string, reason: string }|null}
 */
function getAlternative(name) {
  const entry = alternatives[name];
  if (!entry) return null;
  return { name: entry.name, reason: entry.reason };
}

module.exports = { getAlternative };
