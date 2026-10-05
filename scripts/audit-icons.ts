import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Samples extracted icons against the Lodestone to find where the client's
 * numbering disagrees with the catalogue.
 *
 *   npm run audit:icons                  # 120 items, spread across every slot
 *   npm run audit:icons -- --n 400
 *   npm run audit:icons -- --slot ornament   # every item in one slot
 *
 * The catalogue's icon ids come from the global datamining data, while the
 * icons themselves are extracted from whichever client is installed. When those
 * two disagree an item quietly shows a picture of something else — a wrong
 * icon, not a missing one, so nothing flags it.
 *
 * Comparison is on downscaled pixels rather than file bytes: the Lodestone
 * serves re-encoded PNGs that never match an extraction byte for byte, but a
 * different picture is obvious at 8x8.
 */

const DATA_DIR = join(process.cwd(), 'public', 'data');
const ICON_DIR = join(process.cwd(), 'icons');

const ID_MAP_URL =
  'https://raw.githubusercontent.com/Asvel/ffxiv-lodestone-item-id/master/lodestone-item-id.txt';
const REGION = process.env.LODESTONE_REGION ?? 'na';
const USER_AGENT = 'ff14-glamour-card icon audit (sampling)';
const OG_IMAGE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const DELAY_MS = 1200;

/** Mean per-channel difference above which two icons are different pictures. */
const DIFFERENT = 28;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/** An 8x8 RGB thumbnail, which is enough to tell two icons apart. */
async function fingerprint(input: string | Buffer): Promise<Buffer> {
  return sharp(input).resize(8, 8, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}

function difference(a: Buffer, b: Buffer): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

async function main() {
  const sizeFlag = process.argv.indexOf('--n');
  const slotFlag = process.argv.indexOf('--slot');
  const onlySlot = slotFlag >= 0 ? process.argv[slotFlag + 1] : null;
  const sampleSize = sizeFlag >= 0 ? Number(process.argv[sizeFlag + 1]) : 120;

  const idMap = (await fetch(ID_MAP_URL).then((r) => r.text())).split('\n');

  // Spread the sample across slots and item levels rather than taking the first
  // N, so a problem confined to recent content still shows up.
  const candidates: { slot: string; itemId: number; iconId: number; name: string }[] = [];
  for (const file of await readdir(join(DATA_DIR, 'items'))) {
    if (!file.endsWith('.json')) continue;
    const slot = file.replace('.json', '');
    if (onlySlot && slot !== onlySlot) continue;
    const { items } = JSON.parse(await readFile(join(DATA_DIR, 'items', file), 'utf8')) as {
      items: [number, number, number, number, number, number, string, string | null, string | null][];
    };
    const sorted = items.slice().sort((a, b) => b[5] - a[5]);
    // One slot is checked exhaustively; a spread across all of them steps
    // through item levels so a problem confined to recent content still shows.
    const step = onlySlot
      ? 1
      : Math.max(1, Math.floor(sorted.length / Math.ceil(sampleSize / 14)));
    for (let i = 0; i < sorted.length; i += step) {
      const row = sorted[i];
      candidates.push({ slot, itemId: row[0], iconId: row[1], name: row[8] ?? row[6] });
    }
  }

  const sample = onlySlot ? candidates : candidates.slice(0, sampleSize);
  console.log(`\n  sampling ${sample.length} items; about ${Math.ceil((sample.length * DELAY_MS * 2) / 60000)} minutes\n`);

  let checked = 0;
  let matched = 0;
  const wrong: typeof sample = [];
  const skipped: string[] = [];

  for (const entry of sample) {
    const src = sourcePath(entry.iconId);
    if (!(await exists(src))) {
      skipped.push(`${entry.name}: no extracted icon`);
      continue;
    }
    const lodestoneId = idMap[entry.itemId - 1]?.trim();
    if (!lodestoneId) {
      skipped.push(`${entry.name}: not on the Lodestone`);
      continue;
    }

    try {
      await sleep(DELAY_MS);
      const page = await fetch(
        `https://${REGION}.finalfantasyxiv.com/lodestone/playguide/db/item/${lodestoneId}/`,
        { headers: { 'user-agent': USER_AGENT } },
      );
      if (!page.ok) {
        skipped.push(`${entry.name}: page ${page.status}`);
        continue;
      }
      const url = OG_IMAGE.exec(await page.text())?.[1];
      if (!url?.includes('/itemicon/')) {
        skipped.push(`${entry.name}: no icon on the page`);
        continue;
      }

      await sleep(DELAY_MS);
      const image = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
      if (!image.ok) {
        skipped.push(`${entry.name}: image ${image.status}`);
        continue;
      }

      const gap = difference(
        await fingerprint(src),
        await fingerprint(Buffer.from(await image.arrayBuffer())),
      );
      checked++;
      if (gap <= DIFFERENT) matched++;
      else wrong.push(entry);

      if (checked % 20 === 0) {
        console.log(`    ${checked} checked, ${wrong.length} wrong so far`);
      }
    } catch {
      skipped.push(`${entry.name}: fetch failed`);
    }
  }

  const rate = checked ? (wrong.length / checked) * 100 : 0;
  console.log(`\n  compared : ${checked}`);
  console.log(`  matching : ${matched}`);
  console.log(`  wrong    : ${wrong.length}  (${rate.toFixed(1)}%)`);
  if (skipped.length) console.log(`  skipped  : ${skipped.length}`);

  if (wrong.length) {
    console.log('\n  examples:');
    for (const entry of wrong.slice(0, 10)) {
      console.log(`    ${entry.slot.padEnd(10)} icon ${String(entry.iconId).padStart(6)}  ${entry.name}`);
    }
    // Merge with anything a previous run found, so auditing slot by slot
    // accumulates one list for fill:icons to work through.
    const auditPath = join(DATA_DIR, 'icon-audit.json');
    const previous = await readFile(auditPath, 'utf8')
      .then((text) => (JSON.parse(text) as { wrong?: typeof wrong }).wrong ?? [])
      .catch(() => [] as typeof wrong);
    const byIcon = new Map(previous.map((entry) => [entry.iconId, entry]));
    for (const entry of wrong) byIcon.set(entry.iconId, entry);
    const merged = [...byIcon.values()];

    await writeFile(
      auditPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), checked, wrong: merged }, null, 2),
      'utf8',
    );
    console.log(`\n  ${merged.length} known wrong → public/data/icon-audit.json`);
    console.log('  npm run fill:icons   replaces them from the Lodestone');
    console.log(
      rate > 20
        ? '\n  A rate this high means the installed client numbers its icons\n' +
            '  differently from the catalogue. Re-extracting from a global client\n' +
            '  fixes every item at once; patching individually would not.'
        : '\n  A handful of disagreements is worth filling from the Lodestone\n' +
            '  rather than re-extracting.',
    );
  } else if (checked) {
    console.log('\n  every sampled icon matches the Lodestone');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
