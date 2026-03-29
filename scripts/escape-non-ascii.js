#!/usr/bin/env node
/**
 * Post-build script: escape non-ASCII characters in JS chunks
 * to prevent Safari SyntaxError on iOS 16 and older.
 */
const fs = require('fs');
const path = require('path');

const chunksDir = path.join(__dirname, '..', '.next', 'static', 'chunks');

function escapeNonAscii(str) {
  return str.replace(/[^\x00-\x7F]/g, (ch) => {
    const code = ch.codePointAt(0);
    if (code <= 0xFFFF) {
      return '\\u' + code.toString(16).padStart(4, '0');
    }
    // surrogate pair for characters above BMP
    const hi = Math.floor((code - 0x10000) / 0x400) + 0xD800;
    const lo = ((code - 0x10000) % 0x400) + 0xDC00;
    return '\\u' + hi.toString(16) + '\\u' + lo.toString(16);
  });
}

function processDir(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += processDir(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const escaped = escapeNonAscii(content);
      if (content !== escaped) {
        fs.writeFileSync(fullPath, escaped, 'utf8');
        count++;
      }
    }
  }
  return count;
}

if (fs.existsSync(chunksDir)) {
  const count = processDir(chunksDir);
  console.log(`Escaped non-ASCII in ${count} JS files.`);
} else {
  console.log('No chunks directory found, skipping.');
}
