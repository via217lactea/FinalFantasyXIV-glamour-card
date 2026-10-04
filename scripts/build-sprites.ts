import { access, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

/**
 * Packs the individual icon files into sprite sheets.
 *
 *   npm run build:sprites
 *
 * Cloudflare Pages allows 20,000 files per deployment on the free plan, and the
 * catalogue alone is over 18,000 icons — a couple of patches from refusing to
 * deploy. Sheets take that to a few hundred files permanently.
 *
 * Two decisions shape the layout:
 *
 *  - Sheets are small (64 icons). A large sheet means a card showing fourteen
 *    pieces pulls megabytes, and the PNG exporter inlines whatever a sprite
 *    references into the image it rasterises, once per element. Small sheets
 *    keep both costs down.
 *
 *  - Icons are ordered within a slot exactly as the search orders them, by
 *    descending item level. The first page of results then lands in one or two
 *    sheets instead of sixty separate requests, which makes this a gain over
 *    per-file icons rather than a compromise.
 */

const ICON_PX = 40;
const PER_SHEET = 64;
const COLS = 8;

const ICON_DIR = join(process.cwd(), 'icons');
const SPRITE_DIR = join(process.cwd(), 'public', 'sprites');
const DATA_DIR = join(process.cwd(), 'public', 'data');

interface SheetEntry {
  file: string;
  /** Icon ids in placement order; the index gives the cell. 0 marks a gap. */
  icons: number[];
}

function iconPath(iconId: number): string {
  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
  return join(ICON_DIR, folder, `${String(iconId).padStart(6, '0')}.png`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(ICON_DIR))) {
    console.error('  icons/ is empty — run build:icons first.');
    process.exit(1);
  }

  const bySlot: Record<string, number[]> = {};
  for (const file of await readdir(join(DATA_DIR, 'items'))) {
    if (!file.endsWith('.json')) continue;
    const slot = file.replace('.json', '');
    const { items } = JSON.parse(await readFile(join(DATA_DIR, 'items', file), 'utf8')) as {
      items: [number, number, number, number, number, number, ...unknown[]][];
    };
    const seen = new Set<number>();
    const ordered: number[] = [];
    // Highest item level first, matching the search's default order.
    for (const row of items.slice().sort((a, b) => b[5] - a[5])) {
      const icon = row[1];
      if (icon > 0 && !seen.has(icon)) {
        seen.add(icon);
        ordered.push(icon);
      }
    }
    bySlot[slot] = ordered;
  }

  await rm(SPRITE_DIR, { recursive: true, force: true });
  await mkdir(SPRITE_DIR, { recursive: true });

  const sheets: SheetEntry[] = [];
  let missing = 0;
  let placed = 0;

  for (const [slot, icons] of Object.entries(bySlot)) {
    for (let start = 0; start < icons.length; start += PER_SHEET) {
      const chunk = icons.slice(start, start + PER_SHEET);
      const file = `${slot}-${Math.floor(start / PER_SHEET)}.png`;

      const composites: OverlayOptions[] = [];
      const cells: number[] = [];
      for (const iconId of chunk) {
        const path = iconPath(iconId);
        const cell = cells.length;
        if (!(await exists(path))) {
          missing++;
          // Hold the cell so positions stay aligned with the manifest; the app
          // falls back to its placeholder for a gap.
          cells.push(0);
          continue;
        }
        cells.push(iconId);
        composites.push({
          input: await sharp(path).resize(ICON_PX, ICON_PX, { fit: 'fill' }).png().toBuffer(),
          left: (cell % COLS) * ICON_PX,
          top: Math.floor(cell / COLS) * ICON_PX,
        });
      }

      await sharp({
        create: {
          width: COLS * ICON_PX,
          height: Math.ceil(chunk.length / COLS) * ICON_PX,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite(composites)
        // A palette roughly halves these; icons have few enough colours that
        // the loss is invisible at 40px.
        .png({ palette: true, quality: 90, effort: 7 })
        .toFile(join(SPRITE_DIR, file));

      sheets.push({ file, icons: cells });
      placed += composites.length;
    }
  }

  await writeFile(
    join(DATA_DIR, 'sprites.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), size: ICON_PX, cols: COLS, sheets }),
    'utf8',
  );

  const sizes = await Promise.all(
    sheets.map(async (sheet) => (await stat(join(SPRITE_DIR, sheet.file))).size),
  );
  const total = sizes.reduce((sum, n) => sum + n, 0);

  console.log(`  sheets       : ${sheets.length}`);
  console.log(`  icons placed : ${placed}${missing ? `, ${missing} gaps` : ''}`);
  console.log(`  average sheet: ${Math.round(total / sheets.length / 1024)} KB`);
  console.log(`  total        : ${(total / 1024 / 1024).toFixed(1)} MB`);
  console.log('\n  icons/ stays local; public/sprites is what deploys.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
