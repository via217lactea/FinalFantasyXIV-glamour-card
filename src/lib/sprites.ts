/**
 * Locates an icon inside the sprite sheets.
 *
 * Shipping ~19,300 individual PNGs would sit at 97% of Cloudflare Pages' free
 * 20,000-file limit, leaving no room for a patch. The sheets bring that to a
 * couple of dozen files and drop ~19,000 requests with it.
 */

export interface SpriteIndex {
  cell: number;
  columns: number;
  /** icon id -> [sheet, column, row] */
  index: Record<number, [number, number, number]>;
}

let pending: Promise<SpriteIndex | null> | null = null;

export function loadSprites(): Promise<SpriteIndex | null> {
  pending ??= fetch('/sprites/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<SpriteIndex>) : null))
    // No sheets is a normal state: a fresh checkout has no icons at all, and
    // the app falls back to slot-initial frames.
    .catch(() => null);
  return pending;
}

export interface SpritePosition {
  sheet: string;
  /** Background offset and size for a cell scaled to `size` pixels. */
  style: React.CSSProperties;
}

export function spritePosition(
  sprites: SpriteIndex,
  iconId: number,
  size: string,
): SpritePosition | null {
  const entry = sprites.index[iconId];
  if (!entry) return null;
  const [sheet, column, row] = entry;
  return {
    sheet: `/sprites/${sheet}.png`,
    style: {
      // The sheet is scaled so one cell matches the requested size, then
      // shifted so the wanted cell lands in the box. Sizes are in em inside the
      // gear list, so these are expressed as multiples of the element size.
      backgroundImage: `url(/sprites/${sheet}.png)`,
      backgroundSize: `calc(${size} * ${sprites.columns}) auto`,
      backgroundPosition: `calc(${size} * ${-column}) calc(${size} * ${-row})`,
      backgroundRepeat: 'no-repeat',
    },
  };
}
