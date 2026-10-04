import { create } from 'zustand';
import type { Item, Lang, Stain } from '../lib/catalog.ts';
import type { CardTheme, Theme } from '../lib/theme.ts';
import type { DyeStyle } from '../card/types.ts';
import { DEFAULT_TEMPLATE } from '../card/registry.ts';
import { UI_SLOTS } from '../../scripts/slots.ts';

export type UiSlotId = (typeof UI_SLOTS)[number]['id'];

export interface SlotState {
  item: Item | null;
  /** Index 0 is dye slot 1, index 1 is dye slot 2 (added in 7.0). */
  dyes: [Stain | null, Stain | null];
}

/** Card proportions, chosen for where the card is going to be posted. */
export const LAYOUTS = {
  square: { ratio: 1, imageShare: 0.5 },
  landscape: { ratio: 4 / 3, imageShare: 0.52 },
  wide: { ratio: 16 / 9, imageShare: 0.55 },
} as const;

export type LayoutId = keyof typeof LAYOUTS;

export interface CardMeta {
  characterName: string;
  world: string;
  job: string;
  title: string;
}

interface CardStore {
  slots: Record<UiSlotId, SlotState>;
  meta: CardMeta;
  /** A downscaled data URL — never an object URL, which can taint the export. */
  image: string | null;
  /** Which point of the screenshot the crop keeps centred, in percent. */
  imageFocus: { x: number; y: number };
  layout: LayoutId;
  theme: Theme;
  /** The card can keep its own look — a dark card still reads well posted into
   *  a light timeline, and vice versa. */
  cardTheme: CardTheme;
  /** Which entry in the template registry renders the card. */
  templateId: string;
  /** Swatch chips read like the game; plain text reads like a magazine. Kept
   *  independent of the template so either look works with either. */
  dyeStyle: DyeStyle;
  /** Print the item's other-language names under the primary one. */
  showSubNames: boolean;
  /** The language of the interface. */
  uiLang: Lang;
  /** The language the card prints in. 'auto' follows the interface, which is
   *  what almost everyone wants; an explicit value lets a Korean player share a
   *  card that reads in English. */
  cardLang: Lang | 'auto';
  /** Screenshot zoom, 1 = fit. */
  imageZoom: number;

  setItem(slot: UiSlotId, item: Item | null): void;
  setDye(slot: UiSlotId, index: 0 | 1, stain: Stain | null): void;
  setMeta(patch: Partial<CardMeta>): void;
  setImage(image: string | null): void;
  setImageFocus(focus: { x: number; y: number }): void;
  setLayout(layout: LayoutId): void;
  setTheme(theme: Theme): void;
  setCardTheme(cardTheme: CardTheme): void;
  setTemplateId(templateId: string): void;
  setDyeStyle(dyeStyle: DyeStyle): void;
  setShowSubNames(showSubNames: boolean): void;
  setUiLang(lang: Lang): void;
  setCardLang(lang: Lang | 'auto'): void;
  setImageZoom(zoom: number): void;
  clear(): void;
  reset(): void;
}

const emptySlots = () =>
  Object.fromEntries(
    UI_SLOTS.map((s) => [s.id, { item: null, dyes: [null, null] }]),
  ) as Record<UiSlotId, SlotState>;

export const useCard = create<CardStore>((set) => ({
  slots: emptySlots(),
  meta: { characterName: '', world: '', job: '', title: '' },
  image: null,
  imageFocus: { x: 50, y: 50 },
  imageZoom: 1,
  layout: 'landscape',
  theme: 'light',
  cardTheme: 'auto',
  templateId: DEFAULT_TEMPLATE,
  dyeStyle: 'swatch',
  showSubNames: true,
  uiLang: 'ko',
  cardLang: 'auto',

  setItem: (slot, item) =>
    set((state) => ({
      slots: {
        ...state.slots,
        // Dropping to a piece with fewer dye channels must drop the extra dye,
        // or the card would print a colour the game cannot apply.
        [slot]: {
          item,
          dyes: [
            (item?.dyeCount ?? 0) >= 1 ? state.slots[slot].dyes[0] : null,
            (item?.dyeCount ?? 0) >= 2 ? state.slots[slot].dyes[1] : null,
          ] as [Stain | null, Stain | null],
        },
      },
    })),

  setDye: (slot, index, stain) =>
    set((state) => {
      const dyes: [Stain | null, Stain | null] = [...state.slots[slot].dyes];
      dyes[index] = stain;
      return { slots: { ...state.slots, [slot]: { ...state.slots[slot], dyes } } };
    }),

  setMeta: (patch) => set((state) => ({ meta: { ...state.meta, ...patch } })),
  // A new screenshot gets a fresh crop; keeping the old focus point almost
  // always framed the wrong part of the picture.
  setImage: (image) => set({ image, imageFocus: { x: 50, y: 50 }, imageZoom: 1 }),
  setImageFocus: (imageFocus) => set({ imageFocus }),
  setImageZoom: (imageZoom) => set({ imageZoom }),
  setLayout: (layout) => set({ layout }),
  setTheme: (theme) => set({ theme }),
  setCardTheme: (cardTheme) => set({ cardTheme }),
  setTemplateId: (templateId) => set({ templateId }),
  setDyeStyle: (dyeStyle) => set({ dyeStyle }),
  setShowSubNames: (showSubNames) => set({ showSubNames }),
  setUiLang: (uiLang) => set({ uiLang }),
  setCardLang: (cardLang) => set({ cardLang }),
  clear: () =>
    set({
      slots: emptySlots(),
      meta: { characterName: '', world: '', job: '', title: '' },
      image: null,
      imageFocus: { x: 50, y: 50 },
    }),

  // Everything about the card goes back to defaults. The interface language and
  // the app's own light/dark choice deliberately survive: those are how the
  // person uses the tool, not part of the card they are making.
  reset: () =>
    set({
      slots: emptySlots(),
      meta: { characterName: '', world: '', job: '', title: '' },
      image: null,
      imageFocus: { x: 50, y: 50 },
      imageZoom: 1,
      layout: 'landscape',
      cardTheme: 'auto',
      templateId: DEFAULT_TEMPLATE,
      dyeStyle: 'swatch',
      showSubNames: true,
      cardLang: 'auto',
    }),
}));

/** Every dye in play, in slot order. This is the card's colour signature. */
export function dyeStrip(slots: Record<UiSlotId, SlotState>): Stain[] {
  const out: Stain[] = [];
  for (const { id } of UI_SLOTS) {
    for (const dye of slots[id].dyes) if (dye) out.push(dye);
  }
  return out;
}

/** Resolves 'auto' against the interface language. */
export function resolveCardLang(cardLang: Lang | 'auto', uiLang: Lang): Lang {
  return cardLang === 'auto' ? uiLang : cardLang;
}
