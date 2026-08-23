const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const dist = path.resolve('dist');
const indexPath = path.join(dist, 'index.html');
assert.ok(fs.existsSync(indexPath), 'dist/index.html is missing; run npm run build first.');
const index = fs.readFileSync(indexPath, 'utf8');
const localAssets = new Set();

for (const match of index.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
  const raw = match[1];
  if (/^(?:https?:|data:|#|\/\/)/i.test(raw)) continue;
  const clean = raw.split(/[?#]/, 1)[0];
  if (clean) localAssets.add(clean);
}

function diskPath(asset) {
  return path.join(dist, asset.replace(/^\//, ''));
}

for (const asset of localAssets) {
  assert.ok(fs.existsSync(diskPath(asset)), `Missing runtime asset referenced by dist/index.html: ${asset}`);
}

const manifest = [...localAssets].find(asset => /manifest.*\.webmanifest$/i.test(asset));
if (manifest) {
  const manifestData = JSON.parse(fs.readFileSync(diskPath(manifest), 'utf8'));
  for (const icon of manifestData.icons || []) {
    assert.ok(fs.existsSync(diskPath(icon.src)), `Missing manifest icon: ${icon.src}`);
  }
}

console.log(`BUILD_ARTIFACT_INTEGRITY=PASS assets=${localAssets.size}`);
