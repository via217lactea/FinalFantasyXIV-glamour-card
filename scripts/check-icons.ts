import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reports which catalog icons are not on disk yet.
 *
 *   npm run check:icons
 *
 * Unlike `build:icons` this needs no client extraction — it compares the
 * catalogue against what is already on hand. That is what makes patch-day
 * upkeep automatic: refresh the data, see what is newly missing, fill the
 * handful of gaps from the Lodestone. A full extraction is a one-time cost, not
 * a per-patch chore.
 *
 * What counts as "on hand" depends on where this runs. Locally it is the
 * extracted icons/ folder. On a runner there is no game client and no icons/,
 * so it falls back to the committed sprite sheets — which is what actually
 * deploys, and the only honest answer there. Without that fallback a CI run
 * would declare every icon missing and write a list that sends a later
 * fill:icons after twenty thousand of them.
 */

const ICON_DIR = join(process.cwd(), 'icons');
const DATA_DIR = join(process.cwd(), 'public', 'data');

function iconRelPath(iconId: number): string {
  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
  return join(folder, `${String(iconId).padStart(6, '0')}.png`);
}

/** Icon ids already packed into the committed sheets. */
async function packedIcons(): Promise<Set<number> | null> {
  try {
    const manifest = JSON.parse(await readFile(join(DATA_DIR, 'sprites.json'), 'utf8')) as {
      sheets: { icons: number[] }[];
    };
    return new Set(manifest.sheets.flatMap((sheet) => sheet.icons).filter(Boolean));
  } catch {
    return null;
  }
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

  const packed = onDisk.size === 0 ? await packedIcons() : null;
  const source = packed ? 'committed sprites' : 'extracted icons';
  const have = (iconId: number) =>
    packed ? packed.has(iconId) : onDisk.has(iconRelPath(iconId));

  if (onDisk.size === 0 && !packed) {
    console.log('  No icons and no sprites to compare against — nothing to report.');
    return;
  }

  const missing: number[] = [];
  let affected = 0;
  for (const [iconId, uses] of needed) {
    if (!have(iconId)) {
      missing.push(iconId);
      affected += uses;
    }
  }
  missing.sort((a, b) => a - b);

  // Earlier versions of fill:icons resolved facewear and ornament ids against
  // the Lodestone's item map, which they do not belong to, and wrote whatever
  // unrelated item that landed on. Flag those so they can be re-extracted.
  const suspect: number[] = [];
  for (const slot of ['facewear', 'ornament']) {
    try {
      const { items } = JSON.parse(
        await readFile(join(DATA_DIR, 'items', `${slot}.json`), 'utf8'),
      ) as { items: [number, number, ...unknown[]][] };
      for (const [, icon] of items) if (have(icon)) suspect.push(icon);
    } catch {
      // slot not present
    }
  }

  const manifest = join(DATA_DIR, 'missing-icons.json');
  await writeFile(
    manifest,
    JSON.stringify({ generatedAt: new Date().toISOString(), missing }),
    'utf8',
  );

  const held = needed.size - missing.length;
  console.log(`  catalogue needs : ${needed.size} icons`);
  console.log(`  in ${source.padEnd(13)}: ${held} (${((held / needed.size) * 100).toFixed(1)}%)`);
  console.log(`  missing         : ${missing.length}, affecting ${affected} items`);

  if (missing.length) {
    console.log(`  written to public/data/missing-icons.json`);
    console.log(`  fill the gap with: npm run fill:icons`);
  }
  if (suspect.length) {
    console.log(
      `\n  note: ${suspect.length} facewear/ornament icons cannot be checked or\n` +
        '  fetched from the Lodestone — their ids belong to their own sheets, not\n' +
        '  the item map. They must come from a game client extraction.',
    );
  }

  // Non-zero exit lets CI decide whether a fill step is worth running.
  process.exit(missing.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

