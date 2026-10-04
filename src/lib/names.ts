import type { Item, Lang } from './catalog.ts';

const SECONDARY_ORDER: Lang[] = ['en', 'ja', 'ko'];

/**
 * The names in the languages the card is *not* printing in. Korean players share
 * cards across regions, and a reader who cannot search "신생 연왕국 여왕 티아라"
 * can still search "Neo Queen's Tiara".
 */
export function otherNames(name: Item['name'], primary: Lang): string {
  return SECONDARY_ORDER.filter((lang) => lang !== primary)
    .map((lang) => name[lang])
    .filter((value): value is string => Boolean(value))
    .join(' / ');
}
