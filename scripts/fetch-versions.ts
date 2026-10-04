import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Records which patch each region's data reflects.
 *
 *   npm run build:versions
 *
 * Korean is exact: the datamining repo tags every patch (v7.55, v7.51h …), and
 * the tag feed needs no authentication.
 *
 * Global has no machine-readable source in any repo. The Lodestone appends a
 * cache-busting marker to its item icon URLs that tracks the live patch —
 * .../itemicon/30/30a2…png?n7.55 — so we read one item page and take that. It is
 * a derived signal rather than a published version string, so a manual override
 * wins if it is ever wrong.
 */

const KO_TAGS = 'https://github.com/Ra-Workspace/ffxiv-datamining-ko/tags.atom';
const LODESTONE_ITEM = (region: string, id: string) =>
  `https://${region}.finalfantasyxiv.com/lodestone/playguide/db/item/${id}/`;
/** Any long-lived item works; this one has existed since 2.0. */
const PROBE_ITEM = 'fb177317b75';

const OUT = join(process.cwd(), 'public', 'data', 'versions.json');
const OVERRIDE = join(process.cwd(), 'data', 'version-override.json');

async function koreanVersion(): Promise<string | null> {
  const res = await fetch(KO_TAGS);
  if (!res.ok) return null;
  // Tags are newest-first; the feed title is the repo name, so skip it.
  const titles = [...(await res.text()).matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  return titles.slice(1).find((t) => /^v?\d+\.\d+/.test(t))?.replace(/^v/, '') ?? null;
}

async function globalVersion(region = 'na'): Promise<string | null> {
  try {
    const res = await fetch(LODESTONE_ITEM(region, PROBE_ITEM), {
      headers: { 'user-agent': 'ff14-glamour-card version probe' },
    });
    if (!res.ok) return null;
    return /\/itemicon\/[^"']+\.png\?n([\d.]+)/.exec(await res.text())?.[1] ?? null;
  } catch {
    return null;
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function main() {
  const previous = await readJson<{ ko?: string; global?: string }>(OUT);
  const override = await readJson<{ ko?: string; global?: string }>(OVERRIDE);

  const [ko, global] = await Promise.all([koreanVersion(), globalVersion()]);

  // Never regress to null: a flaky fetch should not blank the badge in the UI.
  const result = {
    ko: override?.ko ?? ko ?? previous?.ko ?? null,
    global: override?.global ?? global ?? previous?.global ?? null,
    fetchedAt: new Date().toISOString(),
  };

  await writeFile(OUT, JSON.stringify(result), 'utf8');
  console.log(`  korean  : ${result.ko ?? '(unknown)'}${ko ? '' : '  [kept previous]'}`);
  console.log(`  global  : ${result.global ?? '(unknown)'}${global ? '' : '  [kept previous]'}`);
  if (override) console.log('  (data/version-override.json applied)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
