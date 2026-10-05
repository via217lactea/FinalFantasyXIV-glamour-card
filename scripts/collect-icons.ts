import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

/**
 * Turns a full client icon dump into just the icons this project needs.
 *
 *   npm run build:icons -- --from "C:/SaintCoinach/<version>/ui/icon"
 *
 * A full extraction is >100k files; the equipment catalog only references
 * ~18.5k of them. Everything else is actions, map pins, macro art and so on.
 *
 * Works with any dumper (SaintCoinach `ui`, Lumina, TexTools) because it walks
 * the source tree recursively and keys off the six-digit filename rather than
 * assuming a folder layout.
 */

/** Build input, deliberately outside public/: everything under public/ is
 *  copied into the deployment, and 19,000 files would blow past Cloudflare's
 *  limit. build:sprites packs these into public/sprites instead. */
const OUT_DIR = join(process.cwd(), 'icons');
const DATA_DIR = join(process.cwd(), 'public', 'data', 'items');

/** 026530.png -> 26530 ; 026530_hr1.png -> 26530 (high-res variant) */
const ICON_FILE = /^(\d{6})(_hr1)?$/;

interface Candidate {
  path: string;
  /** Higher wins. See rank(). */
  score: number;
}

/**
 * How much a file is wanted when several carry the same icon id.
 *
 * An extraction holds more than one picture per id: the plain icon sits in the
 * numbered folder, while `hq/` holds the high-quality variant and the language
 * folders hold localised ones. Only the plain icon is the item's ordinary art,
 * so a nested file must never beat it — and since a directory walk reaches the
 * subfolders first, "first one found" quietly picked the wrong picture.
 *
 * Within the right folder the `_hr1` variant is preferred: exports run at two
 * or three times size, where 40px art visibly softens.
 */
function rank(relativeDir: string, hr: boolean): number {
  const nested = relativeDir.length > 0;
  return (nested ? 0 : 2) + (hr ? 1 : 0);
}

async function walk(
  dir: string,
  found: Map<number, Candidate>,
  depth = 0,
  /** Folders entered below the numbered one, e.g. "hq" or "en". */
  nesting = '',
): Promise<void> {
  if (depth > 6) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // A folder whose name is six digits is the icon bucket itself; anything
      // inside that is a variant folder and gets marked as nested.
      const isBucket = /^\d{6}$/.test(entry.name);
      await walk(full, found, depth + 1, isBucket ? '' : join(nesting, entry.name));
      continue;
    }
    if (extname(entry.name).toLowerCase() !== '.png') continue;

    const match = ICON_FILE.exec(basename(entry.name, extname(entry.name)));
    if (!match) continue;

    const id = Number(match[1]);
    const score = rank(nesting, Boolean(match[2]));
    const existing = found.get(id);
    if (!existing || score > existing.score) found.set(id, { path: full, score });
  }
}

async function neededIconIds(): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  for (const file of await readdir(DATA_DIR)) {
    if (!file.endsWith('.json')) continue;
    const { items } = JSON.parse(await readFile(join(DATA_DIR, file), 'utf8')) as {
      items: [number, number, ...unknown[]][];
    };
    for (const row of items) counts.set(row[1], (counts.get(row[1]) ?? 0) + 1);
  }
  return counts;
}

function outputPath(iconId: number): string {
  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
  return join(OUT_DIR, folder, `${String(iconId).padStart(6, '0')}.png`);
}

async function main() {
  const fromIndex = process.argv.indexOf('--from');
  const source = fromIndex >= 0 ? process.argv[fromIndex + 1] : undefined;
  if (!source) {
    console.error('Usage: npm run build:icons -- --from <extracted icon directory>');
    process.exit(1);
  }
  try {
    if (!(await stat(source)).isDirectory()) throw new Error('not a directory');
  } catch {
    console.error(`Cannot read source directory: ${source}`);
    process.exit(1);
  }

  console.log('▸ indexing catalog…');
  const needed = await neededIconIds();
  const totalItems = [...needed.values()].reduce((a, b) => a + b, 0);
  console.log(`  ${needed.size} unique icons referenced by ${totalItems} items`);

  console.log('▸ scanning source…');
  const available = new Map<number, Candidate>();
  await walk(source, available);
  console.log(`  ${available.size} icon files found`);

  console.log('▸ copying…');
  let copied = 0;
  let hrCount = 0;
  let nested = 0;
  const missing: number[] = [];

  for (const id of needed.keys()) {
    const candidate = available.get(id);
    if (!candidate) {
      missing.push(id);
      continue;
    }
    const dest = outputPath(id);
    await mkdir(join(dest, '..'), { recursive: true });
    await copyFile(candidate.path, dest);
    copied++;
    if (candidate.score % 2 === 1) hrCount++;
    if (candidate.score < 2) nested++;
  }

  console.log(
    `  copied ${copied} (${hrCount} high-res` +
      (nested ? `, ${nested} only available in a variant folder` : '') +
      ')',
  );

  if (missing.length) {
    missing.sort((a, b) => a - b);
    // Items missing an icon still need to render, so the app falls back to a
    // slot placeholder. Knowing which ones lets you check whether the gap is
    // just newer-than-your-client gear.
    const affected = missing.reduce((sum, id) => sum + (needed.get(id) ?? 0), 0);
    await writeFile(
      join(process.cwd(), 'public', 'data', 'missing-icons.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), missing }),
      'utf8',
    );
    console.log(`\n  ! ${missing.length} icons missing, affecting ${affected} items`);
    console.log(`    ids written to public/data/missing-icons.json`);
    console.log(`    first few: ${missing.slice(0, 8).join(', ')}`);
    console.log(
      `    a Korean client lags the global one, so newer global gear is the usual cause`,
    );
  } else {
    console.log('\n  full coverage');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
