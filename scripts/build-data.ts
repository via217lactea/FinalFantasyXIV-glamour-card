import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readSheet, type Sheet } from './csv.ts';
import { fetchSheet, type Lang } from './sources.ts';
import { ESC_COLUMN_TO_SLOT, SLOTS, SLOT_BIT, UI_SLOTS, type Slot } from './slots.ts';

const OUT_DIR = join(process.cwd(), 'public', 'data');
const LANGS: Lang[] = ['en', 'ja', 'ko'];

/** Load one sheet in every language. Korean is optional — its client lags. */
async function loadTrilingual(sheet: string): Promise<Record<Lang, Sheet | null>> {
  const out = { en: null, ja: null, ko: null } as Record<Lang, Sheet | null>;
  await Promise.all(
    LANGS.map(async (lang) => {
      try {
        out[lang] = readSheet(await fetchSheet(lang, sheet));
      } catch (err) {
        console.warn(`  ! ${sheet} [${lang}] unavailable: ${(err as Error).message}`);
      }
    }),
  );
  return out;
}

/**
 * EquipSlotCategory rows are a row of flags: 1 = occupies the slot,
 * -1 = the slot is hidden/blocked by this piece (e.g. a robe that covers legs).
 * The hidden mask is worth keeping — glamour cards want to say "이 옷은 다리를 가립니다".
 */
function buildSlotMasks(esc: Sheet) {
  const occupies = new Map<number, number>();
  const hides = new Map<number, number>();

  for (const [key, row] of esc.rows) {
    let occ = 0;
    let hid = 0;
    for (const [column, slot] of Object.entries(ESC_COLUMN_TO_SLOT)) {
      const v = row.int(column);
      if (v === 1) occ |= SLOT_BIT[slot as Slot];
      else if (v === -1) hid |= SLOT_BIT[slot as Slot];
    }
    occupies.set(key, occ);
    hides.set(key, hid);
  }
  return { occupies, hides };
}

/** 0xRRGGBB packed into a signed int by the game's exporter. */
function toHex(packed: number): string {
  return '#' + (packed & 0xffffff).toString(16).padStart(6, '0');
}

async function main() {
  console.log('▸ fetching sheets…');
  const [item, stain, esc, uiCat] = await Promise.all([
    loadTrilingual('Item'),
    loadTrilingual('Stain'),
    fetchSheet('en', 'EquipSlotCategory').then(readSheet),
    loadTrilingual('ItemUICategory'),
  ]);

  if (!item.en) throw new Error('English Item sheet is required and failed to load');
  for (const lang of LANGS) {
    console.log(`  ${lang}: Item ${item[lang]?.size ?? 0} rows, Stain ${stain[lang]?.size ?? 0} rows`);
  }

  const { occupies, hides } = buildSlotMasks(esc);

  // ---- items -------------------------------------------------------------
  console.log('▸ merging items…');
  type Packed = [
    id: number,
    icon: number,
    slotMask: number,
    hidesMask: number,
    dyeCount: number,
    uiCategory: number,
    ilvl: number,
    en: string,
    ja: string | null,
    ko: string | null,
  ];

  const items: Packed[] = [];
  let missingKo = 0;
  let dualDye = 0;

  for (const [id, row] of item.en.rows) {
    const escId = row.int('EquipSlotCategory');
    if (!escId) continue;

    const slotMask = occupies.get(escId) ?? 0;
    if (!slotMask) continue; // waist / soul crystal only

    const nameEn = row.str('Name');
    if (!nameEn) continue;

    const nameJa = item.ja?.rows.get(id)?.str('Name') || null;
    const nameKo = item.ko?.rows.get(id)?.str('Name') || null;
    if (!nameKo) missingKo++;

    const dyeCount = row.int('DyeCount');
    if (dyeCount >= 2) dualDye++;

    items.push([
      id,
      row.int('Icon'),
      slotMask,
      hides.get(escId) ?? 0,
      dyeCount,
      row.int('ItemUICategory'),
      row.int('LevelEquip'),
      nameEn,
      nameJa,
      nameKo,
    ]);
  }

  items.sort((a, b) => a[0] - b[0]);

  // ---- stains ------------------------------------------------------------
  console.log('▸ merging stains…');
  type PackedStain = [
    id: number,
    hex: string,
    shade: number,
    subOrder: number,
    en: string,
    ja: string | null,
    ko: string | null,
  ];

  const stains: PackedStain[] = [];
  const stainSource = stain.en ?? stain.ko;
  if (stainSource) {
    for (const [id, row] of stainSource.rows) {
      const packed = row.int('Color');
      const nameEn = stain.en?.rows.get(id)?.str('Name') || '';
      const nameJa = stain.ja?.rows.get(id)?.str('Name') || null;
      const nameKo = stain.ko?.rows.get(id)?.str('Name') || null;
      if (!nameEn && !nameJa && !nameKo) continue;
      if (id === 0) continue; // "no dye" is represented as null in card state
      if (row.int('Shade') === 0) continue; // unused placeholder rows

      stains.push([
        id,
        toHex(packed),
        row.int('Shade'),
        row.int('SubOrder'),
        nameEn,
        nameJa,
        nameKo,
      ]);
    }
    stains.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
  }

  // ---- appearance-only sheets --------------------------------------------
  // Glasses and fashion accessories are not Items, so they never carry an
  // EquipSlotCategory and the loop above cannot see them. They have their own
  // sheets, their own id space and no dye channels.
  console.log('▸ merging facewear and fashion accessories…');
  const extraSlots: Record<string, Packed[]> = { facewear: [], ornament: [] };

  for (const [slot, sheetName, nameColumn] of [
    ['facewear', 'Glasses', 'Name'],
    ['ornament', 'Ornament', 'Singular'],
  ] as const) {
    const sheet = await loadTrilingual(sheetName);
    if (!sheet.en) {
      console.warn(`  ! ${sheetName} unavailable, skipping ${slot}`);
      continue;
    }
    for (const [id, row] of sheet.en.rows) {
      const nameEn = row.str(nameColumn);
      const iconId = row.int('Icon');
      if (!nameEn || !iconId) continue;
      extraSlots[slot].push([
        id,
        iconId,
        0, // no slot mask; the shard file is the slot
        0, // hides nothing
        0, // neither glasses nor ornaments can be dyed
        0,
        0,
        nameEn,
        sheet.ja?.rows.get(id)?.str(nameColumn) || null,
        sheet.ko?.rows.get(id)?.str(nameColumn) || null,
      ]);
    }
    extraSlots[slot].sort((a, b) => a[0] - b[0]);
    const noKo = extraSlots[slot].filter((r) => !r[9]).length;
    console.log(`  ${slot}: ${extraSlots[slot].length} entries, ${noKo} without a Korean name`);
  }

  // ---- categories --------------------------------------------------------
  const categories: [number, string, string | null, string | null][] = [];
  if (uiCat.en) {
    for (const [id, row] of uiCat.en.rows) {
      const nameEn = row.str('Name');
      if (!nameEn) continue;
      categories.push([
        id,
        nameEn,
        uiCat.ja?.rows.get(id)?.str('Name') || null,
        uiCat.ko?.rows.get(id)?.str('Name') || null,
      ]);
    }
  }

  // ---- write -------------------------------------------------------------
  // Every item belongs to exactly one slot, so sharding by slot duplicates
  // nothing and lets the editor fetch ~40 KB when a slot is opened instead of
  // ~700 KB up front. Restoring a shared card only needs the slots it uses.
  await mkdir(join(OUT_DIR, 'items'), { recursive: true });
  const generatedAt = new Date().toISOString();

  const write = async (relPath: string, data: unknown) => {
    const json = JSON.stringify(data);
    await writeFile(join(OUT_DIR, relPath), json, 'utf8');
    return { bytes: Buffer.byteLength(json), gz: gzipSync(json).byteLength };
  };

  console.log('▸ writing…');
  const ITEM_FIELDS = ['id', 'icon', 'hidesMask', 'dyeCount', 'uiCategory', 'ilvl', 'en', 'ja', 'ko'];
  const shards: Record<string, { count: number; gzKb: number }> = {};

  for (let bit = 0; bit < SLOTS.length; bit++) {
    const slot = SLOTS[bit];
    const source = extraSlots[slot] ?? items.filter((it) => it[2] & (1 << bit));
    const rows = source.map(
      ([id, icon, , hidesMask, dyeCount, uiCategory, ilvl, en, ja, ko]) => [
        id, icon, hidesMask, dyeCount, uiCategory, ilvl, en, ja, ko,
      ],
    );
    const { gz } = await write(`items/${slot}.json`, {
      generatedAt,
      slot,
      fields: ITEM_FIELDS,
      items: rows,
    });
    shards[slot] = { count: rows.length, gzKb: Math.round(gz / 1024) };
  }

  const stainStat = await write('stains.json', {
    generatedAt,
    fields: ['id', 'hex', 'shade', 'subOrder', 'en', 'ja', 'ko'],
    stains,
  });

  const metaStat = await write('meta.json', {
    generatedAt,
    slots: SLOTS,
    uiSlots: UI_SLOTS,
    itemFields: ITEM_FIELDS,
    shards,
    categories,
  });

  for (const [slot, s] of Object.entries(shards)) {
    console.log(`  items/${slot}.json`.padEnd(28) + `${String(s.count).padStart(6)} items  ${String(s.gzKb).padStart(4)} KB gz`);
  }
  console.log(`  stains.json`.padEnd(28) + `${String(stains.length).padStart(6)} stains ${String(Math.round(stainStat.gz / 1024)).padStart(4)} KB gz`);
  console.log(`  meta.json`.padEnd(28) + `${' '.repeat(13)}${String(Math.round(metaStat.gz / 1024)).padStart(4)} KB gz`);

  console.log('\n▸ summary');
  console.log(`  equippable items : ${items.length}`);
  console.log(`  missing KO name  : ${missingKo} (${((missingKo / items.length) * 100).toFixed(1)}%)`);
  console.log(`  dual dye slots   : ${dualDye}`);
  console.log(`  stains           : ${stains.length}`);
  console.log(`  categories       : ${categories.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
