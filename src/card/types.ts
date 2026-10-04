import type { UI_SLOTS } from '../../scripts/slots.ts';
import type { Item, Lang } from '../lib/catalog.ts';
import type { CardMeta, SlotState } from '../store/card.ts';
import type { Fit } from '../lib/fit.ts';

export type UiSlotId = (typeof UI_SLOTS)[number]['id'];

export interface WornPiece {
  slot: UiSlotId;
  item: Item;
  dyes: SlotState['dyes'];
}

/**
 * Everything a template needs, computed once by CardPreview.
 *
 * Templates receive this and decide only how it looks. Keeping the measuring,
 * the language fallbacks and the slot ordering out here is what makes adding a
 * template a matter of writing markup rather than re-deriving state.
 */
export interface TemplateProps {
  uiLang: Lang;
  cardLang: Lang;
  meta: CardMeta;
  worn: WornPiece[];
  /** How many dye channels are filled across the whole outfit. Individual
   *  colours belong to their piece; a card-wide colour bar competed with the
   *  screenshot for attention, so it is gone. */
  dyeCount: number;
  /** Hex of every dye in play, in slot order. For gradients and weight bars —
   *  not for a card-wide colour strip, which competed with the screenshot. */
  dyeColors: string[];
  image: string | null;
  imageFocus: { x: number; y: number };
  /** 1 = fit; above that the screenshot is cropped in. */
  imageZoom: number;
  /** Fraction of the card width the screenshot should take. */
  imageShare: number;
  showSubNames: boolean;
  /**
   * How hard the row has to economise on height. Set once by CardPreview so
   * every template agrees.
   *
   *  0  every part on its own line
   *  1  dye names fold into the secondary line
   *  2  the secondary line folds into the primary one as well, which is the
   *     only way a full outfit reaches ten rows on a 16:9 card
   */
  density: 0 | 1 | 2;
  dyeStyle: DyeStyle;
  patch: string | null;
  /**
   * Wire boxRef to the clipping box and contentRef to the list itself. Anything
   * sized inside that list must use em, not px — the fitting pass resizes it by
   * changing font-size, and a pixel value would not follow.
   */
  fit: Fit;
}

/** Swatch chips read like the game; plain text reads like a magazine. */
export type DyeStyle = 'swatch' | 'text';

export interface Template {
  id: string;
  /** Shown in the picker, in the interface language. */
  name: Record<Lang, string>;
  author: string;
  /**
   * Languages the layout has actually been checked against. A template built
   * around short Latin names can break badly with a long Korean one, so the
   * picker warns rather than silently producing a broken card.
   */
  languages: Lang[];
  Component: (props: TemplateProps) => React.ReactElement;
}
