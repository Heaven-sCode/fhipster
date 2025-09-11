// utils/file_writer.js
// Safe, repeatable file writing helpers for the FHipster generator.
// - Ensures parent directories exist
// - Normalizes EOLs to '\n' and (optionally) appends a trailing newline
// - Skips overwriting unchanged files (hash/byte-compare) unless forced
// - Can skip overwriting existing files unless --force
// - Supports dry-run mode
// - Provides safeJoin() to keep outputs inside a base directory

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Create a directory (and parents) if missing.
 * @param {string} dir
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Does a path exist?
 * @param {string} p
 * @returns {boolean}
 */
function pathExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Join paths ensuring the result stays within baseDir (prevents path traversal).
 * @param {string} baseDir absolute or relative base
 * @param {...string} parts path segments to join
 * @returns {string} absolute safe path
 * @throws if target escapes baseDir
 */
function safeJoin(baseDir, ...parts) {
  const baseAbs = path.resolve(baseDir);
  const targetAbs = path.resolve(baseAbs, ...parts);
  // allow equal dir or child (handle Windows case-insensitively by normalizing)
  const rel = path.relative(baseAbs, targetAbs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing to write outside base directory:\n  base: ${baseAbs}\n  target: ${targetAbs}`);
  }
  return targetAbs;
}

/**
 * Normalize EOLs and optionally add a final newline.
 * @param {string} s
 * @param {boolean} appendFinalNewline
 * @returns {string}
 */
function normalizeText(s, appendFinalNewline = true) {
  let out = String(s ?? '').replace(/\r\n/g, '\n');
  if (appendFinalNewline && out.length && !out.endsWith('\n')) out += '\n';
  return out;
}

/**
 * Hash a string (sha256) for cheap change detection/logging.
 * @param {string} s
 * @returns {string}
 */
function hashStr(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
}

/**
 * Write a text file safely.
 *
 * @param {string} filePath absolute or relative path
 * @param {string} content file contents
 * @param {object} [opts]
 * @param {boolean} [opts.force=false]       overwrite even if the file exists
 * @param {boolean} [opts.ifUnchangedSkip=true] skip writing when content is identical
 * @param {boolean} [opts.dryRun=false]      don't write, just report what would happen
 * @param {boolean} [opts.appendFinalNewline=true] ensure trailing newline
 * @param {string}  [opts.label]             pretty label for logs
 * @returns {{action: 'wrote'|'skip', reason?: string, path: string}}
 */
function writeFile(filePath, content, opts = {}) {
  const {
    force = false,
    ifUnchangedSkip = true,
    dryRun = false,
    appendFinalNewline = true,
    label,
  } = opts;

  const abs = path.resolve(filePath);
  const dir = path.dirname(abs);
  ensureDir(dir);

  const next = normalizeText(content, appendFinalNewline);

  // If file exists, decide overwrite behavior
  if (fs.existsSync(abs)) {
    const prevRaw = fs.readFileSync(abs, 'utf8');
    const prev = normalizeText(prevRaw, appendFinalNewline);

    if (ifUnchangedSkip && prev === next) {
      logSkip(label || abs, `unchanged (sha:${hashStr(prev)})`);
      return { action: 'skip', reason: 'unchanged', path: abs };
    }

    if (!force) {
      logSkip(label || abs, 'exists (use --force to overwrite)');
      return { action: 'skip', reason: 'exists', path: abs };
    }
  }

  if (!dryRun) {
    fs.writeFileSync(abs, next, 'utf8');
  }
  logWrite(label || abs, next);
  return { action: 'wrote', path: abs };
}

/**
 * Write a JSON file safely (pretty-printed with 2 spaces).
 *
 * @param {string} filePath
 * @param {any} data
 * @param {object} [opts] same as writeFile()
 */
function writeJson(filePath, data, opts = {}) {
  const text = JSON.stringify(data, null, 2) + '\n';
  return writeFile(filePath, text, opts);
}

/**
 * Write many files at once.
 * @param {Array<{path: string, content: string, opts?: object}>} entries
 * @returns {Array<{action: string, path: string}>}
 */
function writeMany(entries) {
  const results = [];
  for (const e of entries) {
    results.push(writeFile(e.path, e.content, e.opts || {}));
  }
  return results;
}

// ----------------- logging -----------------

function logWrite(label, content) {
  const h = hashStr(content);
  console.log(`  ✍️  Wrote: ${label}  (sha:${h})`);
}

function logSkip(label, reason) {
  console.log(`  ↩︎  Skipped: ${label}  — ${reason}`);
}

module.exports = {
  ensureDir,
  pathExists,
  safeJoin,
  writeFile,
  writeJson,
  writeMany,
};
