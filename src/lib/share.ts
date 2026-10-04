import { UI_SLOTS } from '../../scripts/slots.ts';
import type { Lang } from './catalog.ts';
import type { CardTheme } from './theme.ts';
import type { CardMeta, LayoutId } from '../store/card.ts';
import type { DyeStyle } from '../card/types.ts';

/**
 * Packs a card into a URL fragment.
 *
 * The state is written as bytes rather than JSON because the result lives in a
 * link people paste into chat: JSON of a full outfit runs past a thousand
 * characters even compressed, while this is comfortably under two hundred.
 *
 * Layout, in order:
 *
 *   1   version
 *   2   bitmask of which UI slots are filled
 *   n   per filled slot, in slot order: item id (varint), dye 1, dye 2
 *   1   template index
 *   1   packed flags — layout, dye style, card theme, sub-names
 *   1   card language
 *   n   four length-prefixed UTF-8 strings: title, character, world, job
 *
 * The slot bitmask is what makes ids unambiguous. Facewear and fashion
 * accessories come from their own sheets and their ids overlap the Item sheet's,
 * so an id alone cannot say what it refers to — position in the mask does.
 *
 * The screenshot is deliberately absent. A downscaled JPEG is tens of kilobytes
 * of base64, far past any practical URL limit, so a shared link carries the
 * outfit and the recipient supplies their own picture.
 */

const VERSION = 1;

export interface SharedCard {
  slots: { slot: string; itemId: number; dyes: [number | null, number | null] }[];
  meta: CardMeta;
  templateId: string;
  layout: LayoutId;
  dyeStyle: DyeStyle;
  cardTheme: CardTheme;
  showSubNames: boolean;
  cardLang: Lang | 'auto';
}

const LAYOUTS: LayoutId[] = ['square', 'landscape', 'wide'];
const DYE_STYLES: DyeStyle[] = ['swatch', 'text'];
const CARD_THEMES: CardTheme[] = ['auto', 'light', 'dark'];
const LANGS: (Lang | 'auto')[] = ['auto', 'ko', 'ja', 'en'];

class Writer {
  private bytes: number[] = [];

  u8(value: number) {
    this.bytes.push(value & 0xff);
  }

  u16(value: number) {
    this.u8(value >> 8);
    this.u8(value);
  }

  /** Seven bits per byte, high bit marks continuation. */
  varint(value: number) {
    let v = value >>> 0;
    while (v > 0x7f) {
      this.u8((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    this.u8(v);
  }

  text(value: string) {
    const encoded = new TextEncoder().encode(value);
    this.varint(encoded.length);
    for (const byte of encoded) this.u8(byte);
  }

  done(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class Reader {
  private at = 0;

  constructor(private readonly bytes: Uint8Array) {}

  u8(): number {
    if (this.at >= this.bytes.length) throw new Error('truncated');
    return this.bytes[this.at++];
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  varint(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.u8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result >>> 0;
      shift += 7;
      if (shift > 35) throw new Error('varint too long');
    }
  }

  text(): string {
    const length = this.varint();
    if (this.at + length > this.bytes.length) throw new Error('truncated');
    const slice = this.bytes.subarray(this.at, this.at + length);
    this.at += length;
    return new TextDecoder().decode(slice);
  }
}

/** base64url, so the value survives a URL without escaping. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export function encodeCard(card: SharedCard, templateIds: string[]): string {
  const writer = new Writer();
  writer.u8(VERSION);

  const order = UI_SLOTS.map((s) => s.id as string);
  const filled = card.slots.filter((s) => order.includes(s.slot) && s.itemId > 0);
  let mask = 0;
  for (const entry of filled) mask |= 1 << order.indexOf(entry.slot);
  writer.u16(mask);

  // Written in slot order so the reader can pair values back to slots using the
  // mask alone.
  for (const slot of order) {
    const entry = filled.find((s) => s.slot === slot);
    if (!entry) continue;
    writer.varint(entry.itemId);
    writer.u8(entry.dyes[0] ?? 0);
    writer.u8(entry.dyes[1] ?? 0);
  }

  const templateIndex = Math.max(0, templateIds.indexOf(card.templateId));
  writer.u8(templateIndex);

  const flags =
    (Math.max(0, LAYOUTS.indexOf(card.layout)) & 0b11) |
    ((Math.max(0, DYE_STYLES.indexOf(card.dyeStyle)) & 0b1) << 2) |
    ((Math.max(0, CARD_THEMES.indexOf(card.cardTheme)) & 0b11) << 3) |
    ((card.showSubNames ? 1 : 0) << 5);
  writer.u8(flags);
  writer.u8(Math.max(0, LANGS.indexOf(card.cardLang)));

  writer.text(card.meta.title);
  writer.text(card.meta.characterName);
  writer.text(card.meta.world);
  writer.text(card.meta.job);

  return toBase64Url(writer.done());
}

/** Returns null for anything that is not a card this build can read. */
export function decodeCard(encoded: string, templateIds: string[]): SharedCard | null {
  try {
    const reader = new Reader(fromBase64Url(encoded));
    if (reader.u8() !== VERSION) return null;

    const order = UI_SLOTS.map((s) => s.id as string);
    const mask = reader.u16();
    const slots: SharedCard['slots'] = [];
    for (let i = 0; i < order.length; i++) {
      if ((mask & (1 << i)) === 0) continue;
      const itemId = reader.varint();
      const first = reader.u8();
      const second = reader.u8();
      slots.push({
        slot: order[i],
        itemId,
        dyes: [first || null, second || null],
      });
    }

    const templateId = templateIds[reader.u8()] ?? templateIds[0];
    const flags = reader.u8();
    const cardLang = LANGS[reader.u8()] ?? 'auto';

    return {
      slots,
      templateId,
      layout: LAYOUTS[flags & 0b11] ?? 'landscape',
      dyeStyle: DYE_STYLES[(flags >> 2) & 0b1] ?? 'swatch',
      cardTheme: CARD_THEMES[(flags >> 3) & 0b11] ?? 'auto',
      showSubNames: Boolean((flags >> 5) & 0b1),
      cardLang,
      meta: {
        title: reader.text(),
        characterName: reader.text(),
        world: reader.text(),
        job: reader.text(),
      },
    };
  } catch {
    return null;
  }
}

/**
 * The card travels in the fragment rather than the query string: fragments are
 * never sent to the server, so a shared outfit stays between the two people who
 * have the link.
 */
export const SHARE_KEY = 'c';

export function shareUrl(encoded: string): string {
  const url = new URL(window.location.href);
  url.hash = `${SHARE_KEY}=${encoded}`;
  return url.toString();
}

export function readShareParam(hash: string): string | null {
  const raw = hash.replace(/^#/, '');
  if (!raw.startsWith(`${SHARE_KEY}=`)) return null;
  return raw.slice(SHARE_KEY.length + 1) || null;
}

// A theme belongs to the reader, not the card, so it never travels.

