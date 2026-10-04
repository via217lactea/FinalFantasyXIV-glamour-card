import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE_DIR = join(process.cwd(), '.cache');
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/** Global client data (English + Japanese), oxidizer dialect. */
const GLOBAL = 'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv';
/** Korean client data, SaintCoinach dialect. Lags the global client by a patch or two. */
const KOREAN = 'https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko/master/csv';

export type Lang = 'ko' | 'ja' | 'en';

export const SHEET_URLS = {
  en: (sheet: string) => `${GLOBAL}/en/${sheet}.csv`,
  ja: (sheet: string) => `${GLOBAL}/ja/${sheet}.csv`,
  ko: (sheet: string) => `${KOREAN}/${sheet}.csv`,
} satisfies Record<Lang, (sheet: string) => string>;

async function isFresh(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return Date.now() - s.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

export async function fetchSheet(lang: Lang, sheet: string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, `${lang}.${sheet}.csv`);

  if (await isFresh(cachePath)) {
    return readFile(cachePath, 'utf8');
  }

  const url = SHEET_URLS[lang](sheet);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} while fetching ${url}`);
  }
  const text = await res.text();
  await writeFile(cachePath, text, 'utf8');
  return text;
}

/**
 * Icon ids map onto the game's folder layout: 26530 -> ui/icon/026000/026530.
 * We mirror that path locally so icons are served same-origin, which is what
 * keeps the canvas untainted during PNG export.
 */
export function iconPath(iconId: number): string {
  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
  return `${folder}/${String(iconId).padStart(6, '0')}.png`;
}
