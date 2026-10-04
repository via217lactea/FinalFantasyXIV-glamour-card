import type { Slot } from '../../scripts/slots.ts';

export type Lang = 'ko' | 'ja' | 'en';

export interface Item {
  id: number;
  icon: number;
  hidesMask: number;
  dyeCount: 0 | 1 | 2;
  uiCategory: number;
  ilvl: number;
  name: Record<Lang, string | null>;
}

export interface Stain {
  id: number;
  hex: string;
  shade: number;
  name: Record<Lang, string | null>;
}

type PackedItem = [number, number, number, number, number, number, string, string | null, string | null];
type PackedStain = [number, string, number, number, string, string | null, string | null];

const DATA_ROOT = '/data';

/** Multilingual fallback: Korean client lags, so ko -> ja -> en. */
export function displayName(name: Record<Lang, string | null>, lang: Lang): string {
  return name[lang] ?? name.ja ?? name.en ?? '';
}

// ---------------------------------------------------------------------------
// Korean search support
// ---------------------------------------------------------------------------

const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/** "다이아몬드" -> "ㄷㅇㅇㅁㄷ", so a user can type "ㄷㅇㅇ" and still find it. */
export function initials(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHO[Math.floor((code - 0xac00) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

/** True when the query is made up only of standalone Korean initial jamo. */
const INITIALS_ONLY = /^[ㄱ-ㅎ]+$/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s'’·・-]/g, '');
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

interface SearchEntry {
  item: Item;
  haystack: Record<Lang, string>;
  cho: string;
}

const slotCache = new Map<Slot, Promise<SearchEntry[]>>();
let stainCache: Promise<Stain[]> | null = null;

function hydrate(p: PackedItem): Item {
  return {
    id: p[0],
    icon: p[1],
    hidesMask: p[2],
    dyeCount: p[3] as 0 | 1 | 2,
    uiCategory: p[4],
    ilvl: p[5],
    name: { en: p[6], ja: p[7], ko: p[8] },
  };
}

export function loadSlot(slot: Slot): Promise<SearchEntry[]> {
  let pending = slotCache.get(slot);
  if (!pending) {
    pending = fetch(`${DATA_ROOT}/items/${slot}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${slot} catalog (${r.status})`);
        return r.json() as Promise<{ items: PackedItem[] }>;
      })
      .then(({ items }) =>
        items.map((p) => {
          const item = hydrate(p);
          const ko = normalize(item.name.ko ?? '');
          return {
            item,
            haystack: {
              ko,
              ja: normalize(item.name.ja ?? ''),
              en: normalize(item.name.en ?? ''),
            },
            // built from the normalized name so "ㄱㅅㅇㅈㅌ" matches across words
            cho: initials(ko),
          };
        }),
      )
      .catch((err) => {
        slotCache.delete(slot); // let the next attempt retry
        throw err;
      });
    slotCache.set(slot, pending);
  }
  return pending;
}

export function loadStains(): Promise<Stain[]> {
  stainCache ??= fetch(`${DATA_ROOT}/stains.json`)
    .then((r) => r.json() as Promise<{ stains: PackedStain[] }>)
    .then(({ stains }) =>
      stains.map((s) => ({
        id: s[0],
        hex: s[1],
        shade: s[2],
        name: { en: s[4], ja: s[5], ko: s[6] },
      })),
    );
  return stainCache;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Ranks exact match above prefix above substring, then by item level so that
 * current-expansion gear surfaces before its level-15 namesakes. Korean initial
 * matches rank last — they are the widest net.
 */
export async function searchSlot(
  slot: Slot,
  query: string,
  lang: Lang,
  limit = 60,
): Promise<Item[]> {
  const entries = await loadSlot(slot);
  const q = normalize(query);
  if (!q) {
    return entries
      .slice()
      .sort((a, b) => b.item.ilvl - a.item.ilvl)
      .slice(0, limit)
      .map((e) => e.item);
  }

  const choQuery = INITIALS_ONLY.test(query.replace(/\s/g, '')) ? query.replace(/\s/g, '') : null;
  const order: Lang[] = [lang, ...(['ko', 'ja', 'en'] as Lang[]).filter((l) => l !== lang)];
  const scored: { item: Item; score: number }[] = [];

  for (const entry of entries) {
    let best = 0;

    if (choQuery) {
      if (entry.cho.startsWith(choQuery)) best = 2;
      else if (entry.cho.includes(choQuery)) best = 1;
    } else {
      for (let i = 0; i < order.length; i++) {
        const hay = entry.haystack[order[i]];
        if (!hay) continue;
        const penalty = i; // matches in the active language win ties
        if (hay === q) best = Math.max(best, 10 - penalty);
        else if (hay.startsWith(q)) best = Math.max(best, 7 - penalty);
        else if (hay.includes(q)) best = Math.max(best, 4 - penalty);
      }
    }

    if (best > 0) scored.push({ item: entry.item, score: best });
  }

  scored.sort((a, b) => b.score - a.score || b.item.ilvl - a.item.ilvl);
  return scored.slice(0, limit).map((s) => s.item);
}

// ---------------------------------------------------------------------------
// Icon sprites
// ---------------------------------------------------------------------------

export interface SpriteCell {
  url: string;
  /** Cell offset within the sheet, in px at the packed size. */
  x: number;
  y: number;
  sheetWidth: number;
  sheetHeight: number;
  /** One icon's edge in px, as packed. */
  size: number;
}

interface SpriteManifest {
  size: number;
  cols: number;
  sheets: { file: string; icons: number[] }[];
}

let spritePromise: Promise<Map<number, SpriteCell>> | null = null;

/**
 * Icons ship as sprite sheets rather than 18,000 separate files: Cloudflare
 * Pages caps a deployment at 20,000 on the free plan, which the catalogue alone
 * would exhaust within a patch or two.
 *
 * The manifest is fetched once. Sheets load only when something references
 * them, and because each holds one slot's icons in search order, a page of
 * results usually needs just one.
 */
export function loadSprites(): Promise<Map<number, SpriteCell>> {
  spritePromise ??= fetch(`${DATA_ROOT}/sprites.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`sprite manifest ${r.status}`);
      return r.json() as Promise<SpriteManifest>;
    })
    .then(({ size, cols, sheets }) => {
      const cells = new Map<number, SpriteCell>();
      for (const sheet of sheets) {
        const rows = Math.ceil(sheet.icons.length / cols);
        sheet.icons.forEach((iconId, index) => {
          if (!iconId) return; // a gap left by a missing source icon
          cells.set(iconId, {
            url: `/sprites/${sheet.file}`,
            x: -(index % cols) * size,
            y: -Math.floor(index / cols) * size,
            sheetWidth: cols * size,
            sheetHeight: rows * size,
            size,
          });
        });
      }
      return cells;
    })
    .catch((err) => {
      spritePromise = null; // let the next attempt retry
      throw err;
    });
  return spritePromise;
}
