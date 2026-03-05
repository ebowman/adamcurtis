// Simple glob matching without external dependencies

const fs = require('fs');
const path = require('path');

/**
 * Expand a glob pattern like ./subs/*.srt into matching file paths
 * Supports * and ** patterns
 */
function glob(pattern) {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);

  // Convert glob to regex
  const regex = new RegExp(
    '^' + base
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
    + '$'
  );

  const resolvedDir = path.resolve(dir);
  if (!fs.existsSync(resolvedDir)) return [];

  try {
    return fs.readdirSync(resolvedDir)
      .filter(f => regex.test(f))
      .map(f => path.join(resolvedDir, f))
      .filter(f => fs.statSync(f).isFile());
  } catch {
    return [];
  }
}

module.exports = { glob };
