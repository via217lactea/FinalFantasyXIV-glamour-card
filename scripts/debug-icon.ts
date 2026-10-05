import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Traces one item from its name to the pixels that end up on screen.
 *
 *   npm run debug:icon -- "비브라 왕녀 드레스"
 *
 * When an item shows the wrong picture the fault is in one of three places, and
 * they need different fixes:
 *
 *   1. the catalog points at an icon id that is not this item's art
 *   2. the packer put the wrong icon in that cell
 *   3. the app reads the wrong cell out of the sheet
 *
 * It writes three pictures of the same item into debug-icon/:
 *
 *   -source  the icon file extracted from the game client
 *   -packed  the cell the app actually reads out of the sprite sheet
 *   -truth   the icon the Lodestone serves for this item, fetched live
 *
 * Reading them: packed differing from source means the packer misplaced it.
 * Both matching each other but not truth means the extracted client numbers its
 * icons differently from the catalogue — which is what happens when the icons
 * come from a Korean client and the catalogue from global data.
 */

const DATA_DIR = join(process.cwd(), 'public', 'data');
const SPRITE_DIR = join(process.cwd(), 'public', 'sprites');
const ICON_DIR = join(process.cwd(), 'icons');
const OUT_DIR = join(process.cwd(), 'debug-icon');

/** Game item id -> Lodestone id, one per line, by line number. */
const ID_MAP_URL =
  'https://raw.githubusercontent.com/Asvel/ffxiv-lodestone-item-id/master/lodestone-item-id.txt';
const REGION = process.env.LODESTONE_REGION ?? 'na';
const USER_AGENT = 'ff14-glamour-card icon diagnostic';
const OG_IMAGE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;

/**
 * The icon the Lodestone shows for an item, which is the one players see in
 * game. Fetched rather than derived: the URL is a content hash.
 */
async function lodestoneIcon(itemId: number): Promise<Buffer | null> {
  try {
    const map = await fetch(ID_MAP_URL).then((r) => (r.ok ? r.text() : ''));
    const lodestoneId = map.split('\n')[itemId - 1]?.trim();
    if (!lodestoneId) return null;

    const page = await fetch(
      `https://${REGION}.finalfantasyxiv.com/lodestone/playguide/db/item/${lodestoneId}/`,
      { headers: { 'user-agent': USER_AGENT } },
    );
    if (!page.ok) return null;

    const url = OG_IMAGE.exec(await page.text())?.[1];
    if (!url?.includes('/itemicon/')) return null;

    const image = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    return image.ok ? Buffer.from(await image.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

function sourcePath(iconId: number): string {
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
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: npm run debug:icon -- "<item name>"');
    process.exit(1);
  }

  const matches: { slot: string; id: number; icon: number; ko: string; en: string }[] = [];
  for (const file of await readdir(join(DATA_DIR, 'items'))) {
    if (!file.endsWith('.json')) continue;
    const slot = file.replace('.json', '');
    const { items } = JSON.parse(await readFile(join(DATA_DIR, 'items', file), 'utf8')) as {
      items: [number, number, number, number, number, number, string, string | null, string | null][];
    };
    for (const row of items) {
      const ko = row[8] ?? '';
      const en = row[6] ?? '';
      if (ko.includes(query) || en.toLowerCase().includes(query.toLowerCase())) {
        matches.push({ slot, id: row[0], icon: row[1], ko, en });
      }
    }
  }

  if (!matches.length) {
    console.error(`  No item matches "${query}".`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const manifest = JSON.parse(await readFile(join(DATA_DIR, 'sprites.json'), 'utf8')) as {
    size: number;
    cols: number;
    sheets: { file: string; icons: number[] }[];
  };

  for (const match of matches) {
    console.log(`\n  ${match.ko || match.en}`);
    console.log(`    slot ${match.slot}, item ${match.id}, icon ${match.icon}`);

    // Every sheet that carries this icon. More than one is normal — a slot
    // packs its own copy — but they should all be the same art.
    const places = manifest.sheets.flatMap((sheet) => {
      const index = sheet.icons.indexOf(match.icon);
      return index < 0
        ? []
        : [{ file: sheet.file, index, col: index % manifest.cols, row: Math.floor(index / manifest.cols) }];
    });

    if (!places.length) {
      console.log('    not in any sheet — the source icon was missing when sprites were built');
      continue;
    }

    // The app keys by icon id across all sheets, so the last one wins.
    const used = places[places.length - 1];
    console.log(`    sheets: ${places.map((p) => p.file).join(', ')}`);
    console.log(`    app uses ${used.file} cell ${used.index} (col ${used.col}, row ${used.row})`);

    const stem = `${match.slot}-${match.icon}`;
    const cut = join(OUT_DIR, `${stem}-packed.png`);
    await sharp(join(SPRITE_DIR, used.file))
      .extract({
        left: used.col * manifest.size,
        top: used.row * manifest.size,
        width: manifest.size,
        height: manifest.size,
      })
      .toFile(cut);
    console.log(`    packed cell → debug-icon/${stem}-packed.png`);

    const src = sourcePath(match.icon);
    if (await exists(src)) {
      await sharp(src).toFile(join(OUT_DIR, `${stem}-source.png`));
      console.log(`    source icon → debug-icon/${stem}-source.png`);
    } else {
      console.log(`    source icon missing at ${src}`);
    }

    const truth = await lodestoneIcon(match.id);
    if (truth) {
      await writeFile(join(OUT_DIR, `${stem}-truth.png`), truth);
      console.log(`    lodestone  → debug-icon/${stem}-truth.png`);
    } else {
      console.log('    lodestone icon unavailable (no mapping, or the fetch failed)');
    }
  }

  console.log('\n  Compare the three files in debug-icon/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
