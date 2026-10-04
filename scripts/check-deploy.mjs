import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Checks the build against the host's limits before it is uploaded.
 *
 *   npm run check:deploy
 *
 * Cloudflare Pages allows 20,000 files and 25 MiB per file on the free plan.
 * The catalog needs about 19,300 icons, so shipping them individually would sit
 * at 97% of the file limit with no room for a patch — which is why they are
 * packed into sprite sheets and the raw folder is dropped from the build.
 */

const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Leave room for several patches before anyone has to think about this again. */
const COMFORTABLE = 5_000;

const dist = join(process.cwd(), 'dist');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push({ path, bytes: statSync(path).size });
  }
  return out;
}

let files;
try {
  files = walk(dist);
} catch {
  console.error('  No dist/ — run npm run build first.');
  process.exit(1);
}

let failures = 0;
const note = (ok, label) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

const total = files.reduce((sum, f) => sum + f.bytes, 0);
console.log(`\n  ${files.length} files, ${(total / 1024 / 1024).toFixed(1)} MB`);

note(files.length <= MAX_FILES, `under the ${MAX_FILES.toLocaleString()} file limit`);
note(
  files.length <= COMFORTABLE,
  `well under it (${files.length} of ${COMFORTABLE.toLocaleString()} comfortable)`,
);

const oversized = files.filter((f) => f.bytes > MAX_FILE_BYTES);
note(oversized.length === 0, `no file over 25 MiB${oversized.length ? `: ${oversized[0].path}` : ''}`);

// The raw icons are the source the sheets are built from, not something to
// ship. Compare against dist's own root rather than a relative fragment: the
// walk returns absolute paths, so a relative needle silently never matches.
const iconRoot = join(dist, 'icons');
const rawIcons = files.filter((f) => f.path.startsWith(iconRoot));
note(
  rawIcons.length === 0,
  `raw icon folder excluded${rawIcons.length ? ` — ${rawIcons.length} files in dist/icons` : ''}`,
);

const sprites = files.filter((f) => f.path.includes('sprites'));
if (sprites.length === 0) {
  console.log('  · no sprite sheets yet — run build:icons then build:sprites');
} else {
  const largest = sprites.reduce((a, b) => (a.bytes > b.bytes ? a : b));
  note(
    largest.bytes <= MAX_FILE_BYTES,
    `largest sheet is ${(largest.bytes / 1024 / 1024).toFixed(1)} MB`,
  );
}

if (failures) {
  console.error(`\n  ${failures} problem(s); the deployment would be rejected.`);
  process.exit(1);
}
console.log('\n  deployment within limits');
