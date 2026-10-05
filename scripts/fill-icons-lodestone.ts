import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Fills gaps left by a client extraction, using the Lodestone.
 *
 *   npm run fill:icons
 *
 * This is deliberately NOT a way to fetch the whole catalog. Lodestone item
 * icon URLs are content hashes:
 *
 *   https://lds-img.finalfantasyxiv.com/itemicon/30/30a2109c…png?n7.55
 *
 * They cannot be derived from an icon id, so each icon costs one full item
 * page load plus one image request. For all 18,588 icons that is tens of
 * thousands of requests and several GB of HTML to extract ~73 MB of art —
 * slower, ruder and less complete than running SaintCoinach once.
 *
 * For the few hundred icons a Korean client is missing, it is exactly right.
 * Hence the cap below: run this on a gap, not on a catalog.
 */

const REGION = process.env.LODESTONE_REGION ?? 'na';
const ITEM_URL = (lodestoneId: string) =>
  `https://${REGION}.finalfantasyxiv.com/lodestone/playguide/db/item/${lodestoneId}/`;
const ID_MAP_URL =
  'https://raw.githubusercontent.com/Asvel/ffxiv-lodestone-item-id/master/lodestone-item-id.txt';

/** Above this, use a client extraction instead. Override only if you mean it. */
const DEFAULT_CAP = 800;
const DELAY_MS = 1200;
const USER_AGENT = 'ff14-glamour-card icon gap filler (contact: your-email@example.com)';

const OUT_DIR = join(process.cwd(), 'icons');
const DATA_DIR = join(process.cwd(), 'public', 'data');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The item page exposes its icon in the og:image meta tag. */
const OG_IMAGE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;

function iconOutputPath(iconId: number): string {
  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
  return join(OUT_DIR, folder, `${String(iconId).padStart(6, '0')}.png`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadIdMap(): Promise<string[]> {
  const res = await fetch(ID_MAP_URL);
  if (!res.ok) throw new Error(`Could not load the Lodestone id map (${res.status})`);
  return (await res.text()).split('\n');
}

/** Which item ids use each missing icon, so we know what page to open. */
async function itemsByIcon(missing: Set<number>): Promise<Map<number, number[]>> {
  const { readdir } = await import('node:fs/promises');
  const out = new Map<number, number[]>();
  for (const file of await readdir(join(DATA_DIR, 'items'))) {
    if (!file.endsWith('.json')) continue;
    const { items } = JSON.parse(
      await readFile(join(DATA_DIR, 'items', file), 'utf8'),
    ) as { items: [number, number, ...unknown[]][] };
    for (const [itemId, iconId] of items) {
      if (!missing.has(iconId)) continue;
      const list = out.get(iconId) ?? [];
      list.push(itemId);
      out.set(iconId, list);
    }
  }
  return out;
}

async function main() {
  const capFlag = process.argv.indexOf('--cap');
  const cap = capFlag >= 0 ? Number(process.argv[capFlag + 1]) : DEFAULT_CAP;

  const manifestPath = join(DATA_DIR, 'missing-icons.json');
  if (!(await exists(manifestPath))) {
    console.log('No missing-icons.json — run `npm run build:icons` first.');
    console.log('If it produced full coverage, there is nothing to fill.');
    return;
  }

  const { missing } = JSON.parse(await readFile(manifestPath, 'utf8')) as { missing: number[] };

  // Icons that exist but show the wrong picture, from audit:icons.
  const auditPath = join(DATA_DIR, 'icon-audit.json');
  const wrong: number[] = await readFile(auditPath, 'utf8')
    .then((text) => (JSON.parse(text) as { wrong?: { iconId: number }[] }).wrong ?? [])
    .then((entries) => entries.map((entry) => entry.iconId))
    .catch(() => []);

  const replace = new Set(wrong);
  const targets = [...new Set([...missing, ...wrong])];
  console.log(
    `▸ ${targets.length} icons to fetch` +
      (wrong.length ? ` (${missing.length} missing, ${wrong.length} wrong)` : ''),
  );

  if (targets.length > cap) {
    console.error(
      `\nRefusing to fetch ${targets.length} icons (cap ${cap}).\n` +
        `That many gaps means the extraction itself is incomplete — re-run it against a\n` +
        `global client rather than pulling this volume off the Lodestone. To override:\n` +
        `  npm run fill:icons -- --cap ${targets.length}\n`,
    );
    process.exit(1);
  }

  console.log('▸ loading id map…');
  const idMap = await loadIdMap();
  const usage = await itemsByIcon(new Set(targets));

  let filled = 0;
  let noMapping = 0;
  const failed: number[] = [];

  for (const iconId of targets) {
    const dest = iconOutputPath(iconId);
    // A gap is skipped once it is on disk, which makes the run resumable. A
    // wrong icon is already on disk by definition, so it is fetched anyway.
    if (!replace.has(iconId) && (await exists(dest))) {
      filled++;
      continue;
    }

    // Any item using this icon will do; try a few in case one has no page.
    const candidates = (usage.get(iconId) ?? [])
      .map((itemId) => idMap[itemId - 1]?.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (!candidates.length) {
      noMapping++;
      continue;
    }

    let got = false;
    for (const lodestoneId of candidates) {
      try {
        await sleep(DELAY_MS);
        const page = await fetch(ITEM_URL(lodestoneId), {
          headers: { 'user-agent': USER_AGENT },
        });
        if (!page.ok) continue;

        const iconUrl = OG_IMAGE.exec(await page.text())?.[1];
        if (!iconUrl?.includes('/itemicon/')) continue;

        await sleep(DELAY_MS);
        const img = await fetch(iconUrl, { headers: { 'user-agent': USER_AGENT } });
        if (!img.ok) continue;

        await mkdir(join(dest, '..'), { recursive: true });
        await writeFile(dest, Buffer.from(await img.arrayBuffer()));
        got = true;
        break;
      } catch {
        // try the next candidate
      }
    }

    if (got) {
      filled++;
      if (filled % 25 === 0) console.log(`  ${filled}/${targets.length}`);
    } else {
      failed.push(iconId);
    }
  }

  console.log(`\n  filled ${filled}`);
  if (noMapping) console.log(`  ${noMapping} have no Lodestone entry (NPC-only or unreleased gear)`);
  if (failed.length) console.log(`  ${failed.length} failed: ${failed.slice(0, 10).join(', ')}`);
  console.log('\n  Items still without an icon fall back to the slot placeholder.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
