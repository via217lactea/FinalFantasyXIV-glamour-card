import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reports which catalog icons are not on disk yet.
 *
 *   npm run check:icons
 *
 * Unlike `build:icons` this needs no client extraction — it compares the
 * catalog against public/icons/. That is what makes patch-day upkeep automatic:
 * refresh the data, see what is newly missing, fill the handful of gaps from the
 * Lodestone. A full extraction is a one-time cost, not a per-patch chore.
 */

const ICON_DIR = join(process.cwd(), 'icons');
const DATA_DIR = join(process.cwd(), 'public', 'data');

function iconRelPath(iconId: number): string {
  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
  return join(folder, `${String(iconId).padStart(6, '0')}.png`);
}

async function main() {
  const needed = new Map<number, number>(); // icon id -> items using it
  for (const file of await readdir(join(DATA_DIR, 'items'))) {
    if (!file.endsWith('.json')) continue;
    const { items } = JSON.parse(
      await readFile(join(DATA_DIR, 'items', file), 'utf8'),
    ) as { items: [number, number, ...unknown[]][] };
    for (const [, iconId] of items) needed.set(iconId, (needed.get(iconId) ?? 0) + 1);
  }

  await mkdir(ICON_DIR, { recursive: true });

  // One readdir per folder beats 18k individual stat calls.
  const onDisk = new Set<string>();
  for (const folder of await readdir(ICON_DIR)) {
    try {
      for (const file of await readdir(join(ICON_DIR, folder))) {
        onDisk.add(join(folder, file));
      }
    } catch {
      // not a directory
    }
  }

  const missing: number[] = [];
  let affected = 0;
  for (const [iconId, uses] of needed) {
    if (!onDisk.has(iconRelPath(iconId))) {
      missing.push(iconId);
      affected += uses;
    }
  }
  missing.sort((a, b) => a - b);

  const manifest = join(DATA_DIR, 'missing-icons.json');
  await writeFile(
    manifest,
    JSON.stringify({ generatedAt: new Date().toISOString(), missing }),
    'utf8',
  );

  const have = needed.size - missing.length;
  console.log(`  catalog needs : ${needed.size} icons`);
  console.log(`  on disk       : ${have} (${((have / needed.size) * 100).toFixed(1)}%)`);
  console.log(`  missing       : ${missing.length}, affecting ${affected} items`);

  if (missing.length) {
    console.log(`  written to public/data/missing-icons.json`);
    console.log(`  fill the gap with: npm run fill:icons`);
  }

  // Non-zero exit lets CI decide whether a fill step is worth running.
  process.exit(missing.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

