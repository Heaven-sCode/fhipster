// utils/file_writer.js
// Writes files with support for "keep" regions that survive regeneration.
//
// Keep region syntax (in any language):
//   // <fh:keep:imports>
//   // ...user code...
//   // </fh:keep:imports>
//
//   // <fh:keep:custom>
//   // ...user code...
//   // </fh:keep:custom>
//
// Regions are matched by name and replaced in the new content.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEEP_START_RE = /\/\/\s*<fh:keep:([a-zA-Z0-9_-]+)>\s*[\r\n]?/g;
const KEEP_END_TAG = '// </fh:keep:';
const KEEP_END_RE = /\/\/\s*<\/fh:keep:([a-zA-Z0-9_-]+)>\s*[\r\n]?/g;

function sha(content) {
  return crypto.createHash('md5').update(content || '', 'utf8').digest('hex');
}

function readIfExists(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch (_) {
    return null;
  }
}

function extractKeepRegions(text) {
  if (!text) return {};
  const regions = {};
  let startMatch;
  while ((startMatch = KEEP_START_RE.exec(text)) !== null) {
    const name = startMatch[1];
    const startIdx = KEEP_START_RE.lastIndex;
    const endTag = `${KEEP_END_TAG}${name}>`;
    const endIdx = text.indexOf(endTag, startIdx);
    if (endIdx === -1) continue; // malformed; skip
    const body = text.substring(startIdx, endIdx);
    regions[name] = body;
  }
  return regions;
}

function spliceKeepRegions(newContent, oldRegions) {
  if (!oldRegions || Object.keys(oldRegions).length === 0) return newContent;

  // Replace bodies between keep tags in new content if the same tag exists
  return newContent.replace(KEEP_START_RE, (m, name, offset) => {
    const startIdx = offset + m.length;
    const endTag = `${KEEP_END_TAG}${name}>`;
    const endIdx = newContent.indexOf(endTag, startIdx);
    if (endIdx === -1) return m; // unmatched in template

    if (Object.prototype.hasOwnProperty.call(oldRegions, name)) {
      const before = newContent.slice(0, startIdx);
      const after = newContent.slice(endIdx);
      const rebuilt = before + oldRegions[name] + after;
      newContent = rebuilt;
    }
    return m;
  });
}

/**
 * Write a file with optional safe merge of keep regions.
 * @param {string} absPath absolute path to write
 * @param {string} content new content (may include keep regions)
 * @param {boolean} force overwrite if unchanged
 * @param {string} label pretty label for logs
 */
function writeFile(absPath, content, force = false, label = '') {
  const existed = fs.existsSync(absPath);
  const old = readIfExists(absPath);

  // Check for user flag to avoid overwriting (always skip, even with force)
  if (existed && old && old.trim().startsWith('// DO NOT OVERWRITE')) {
    console.log(`  🚫 Skipped: ${absPath}  — user flagged as DO NOT OVERWRITE`);
    return;
  }

  const oldRegions = extractKeepRegions(old);

  let merged = content;
  if (Object.keys(oldRegions).length > 0) {
    merged = spliceKeepRegions(content, oldRegions);
  }

  const nextSha = sha(merged);
  const oldSha = sha(old);

  if (!existed) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, merged, 'utf8');
    console.log(`  ✍️  Wrote: ${absPath}  (sha:${nextSha.slice(0, 12)})`);
    return;
  }

  if (oldSha === nextSha && !force) {
    console.log(`  ↩︎  Skipped: ${absPath}  — unchanged (sha:${oldSha.slice(0, 12)})`);
    return;
  }

  fs.writeFileSync(absPath, merged, 'utf8');
  console.log(`  ✍️  Wrote: ${absPath}  (sha:${nextSha.slice(0, 12)})`);
}

module.exports = { writeFile };
