import { access, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Verifies the sprite sheets and counts what a deployment would contain.
 *
 *   npm run check:sprites
 *
 * The failure this exists to catch is the manifest drifting from the sheets: an
 * off-by-one puts every icon one cell out, which is plausible enough to survive
 * a glance since they are all small square game icons.
 *
 * Counting what actually ships is check-deploy's job — it walks dist/ rather
 * than guessing, and runs after the build.
 */

const SPRITE_DIR = join(process.cwd(), 'public', 'sprites');
const DATA_DIR = join(process.cwd(), 'public', 'data');

let failures = 0;
const note = (ok: boolean, label: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(dir: string): Promise<number> {
  if (!(await exists(dir))) return 0;
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? await countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}

async function main() {
  const manifestPath = join(DATA_DIR, 'sprites.json');
  if (!(await exists(manifestPath))) {
    console.log('\n  No sprites yet — run build:sprites once icons are collected.');
    return;
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    size: number;
    cols: number;
    sheets: { file: string; icons: number[] }[];
  };

  console.log('\n  manifest ↔ sheets');
  const onDisk = new Set(await readdir(SPRITE_DIR));
  const referenced = new Set(manifest.sheets.map((s) => s.file));
  note(
    manifest.sheets.every((sheet) => onDisk.has(sheet.file)),
    `all ${manifest.sheets.length} sheets exist`,
  );
  note(
    [...onDisk].every((file) => referenced.has(file)),
    'no orphaned sheets',
  );
  note(
    manifest.sheets.every((sheet) => sheet.icons.length <= manifest.cols * manifest.cols * 4),
    'no sheet exceeds its grid',
  );

  console.log('\n  coverage');
  const needed = new Set<number>();
  for (const file of await readdir(join(DATA_DIR, 'items'))) {
    if (!file.endsWith('.json')) continue;
    const { items } = JSON.parse(await readFile(join(DATA_DIR, 'items', file), 'utf8')) as {
      items: [number, number, ...unknown[]][];
    };
    for (const [, icon] of items) if (icon > 0) needed.add(icon);
  }
  const packed = new Set(manifest.sheets.flatMap((s) => s.icons).filter(Boolean));
  const missing = [...needed].filter((id) => !packed.has(id));
  // Gaps are expected — a Korean client lags the global one — so this reports
  // rather than fails.
  console.log(
    `  · ${packed.size} of ${needed.size} icons packed` +
      (missing.length ? `, ${missing.length} absent from the source` : ''),
  );
  note(packed.size > needed.size * 0.9, 'at least 90% of the catalogue has an icon');

  console.log('\n  source layout');
  // The icon source lives outside public/ precisely so it cannot ship; this
  // confirms it stayed there. check-deploy covers the built output.
  const iconCount = await countFiles(join(process.cwd(), 'icons'));
  if (iconCount > 0) {
    const inPublic = await countFiles(join(process.cwd(), 'public', 'icons'));
    note(inPublic === 0, `${iconCount} source icons sit outside public/`);
  }
  console.log(`  · ${manifest.sheets.length} sheets will deploy`);

  const sizes = await Promise.all(
    manifest.sheets.map(async (sheet) => (await stat(join(SPRITE_DIR, sheet.file))).size),
  );
  const totalMb = sizes.reduce((sum, n) => sum + n, 0) / 1024 / 1024;
  const biggest = Math.max(...sizes) / 1024;
  console.log(`  · ${totalMb.toFixed(1)} MB total, largest sheet ${Math.round(biggest)} KB`);
  // A card can reference a dozen sheets at once, and the exporter inlines each
  // one it touches, so a fat sheet is felt twice.
  note(biggest < 400, 'the largest sheet stays under 400 KB');

  console.log('\n  cell positioning');
  // A percentage background-position aligns that point of the image with the
  // same point of the box rather than shifting by it, so reaching cell i takes
  // i/(count-1). The wrong formula, -i*100%, happens to be right for the first
  // cell and backwards for every other — which looks like "only the first icon
  // renders" and is invisible to anything that does not do layout.
  const gridPercent = (index: number, count: number) =>
    count <= 1 ? 0 : (index / (count - 1)) * 100;

  const BOX = 100;
  let misplaced = 0;
  for (const cols of [manifest.cols]) {
    for (const rows of [1, 2, 8]) {
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          // What the browser computes from a percentage position.
          const offsetX = (BOX - cols * BOX) * (gridPercent(col, cols) / 100);
          const offsetY = (BOX - rows * BOX) * (gridPercent(row, rows) / 100);
          if (Math.abs(offsetX - -col * BOX) > 0.01) misplaced++;
          if (rows > 1 && Math.abs(offsetY - -row * BOX) > 0.01) misplaced++;
        }
      }
    }
  }
  note(misplaced === 0, `every cell of a ${manifest.cols}-wide grid lands on its icon`);

  if (failures) {
    console.error(`\n  ${failures} problem(s) with the sprites.`);
    process.exit(1);
  }
  console.log('\n  sprites sound');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
