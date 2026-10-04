import { useEffect, useState } from 'react';
import { loadSprites, type SpriteCell } from '../lib/catalog.ts';

interface Props {
  iconId?: number;
  /**
   * Any CSS length. Inside the gear list this must be an em value: the fitting
   * pass resizes the list by changing its font-size, and a pixel size would not
   * follow, so the measured height would not match what actually renders.
   */
  size?: string;
  /** Two or three characters shown when there is no icon. */
  fallback?: string;
}

/**
 * Where a cell sits, as the percentage CSS wants.
 *
 * A single-cell axis has nowhere to travel, and the formula would divide by
 * zero, so it stays at the origin.
 */
function gridPercent(index: number, count: number): number {
  return count <= 1 ? 0 : (index / (count - 1)) * 100;
}

/** One shared fetch for the whole app; the map is small and never changes. */
let cache: Map<number, SpriteCell> | null = null;
const listeners = new Set<() => void>();

function useSprites(): Map<number, SpriteCell> | null {
  const [, bump] = useState(0);
  useEffect(() => {
    if (cache) return;
    const notify = () => bump((n) => n + 1);
    listeners.add(notify);
    loadSprites()
      .then((cells) => {
        cache = cells;
        for (const listener of listeners) listener();
      })
      .catch(() => {
        // Without sprites every icon shows its placeholder, which is a
        // degraded card rather than a broken one.
      });
    return () => {
      listeners.delete(notify);
    };
  }, []);
  return cache;
}

/**
 * An item icon, drawn from a sprite sheet.
 *
 * The icon is a background rather than an `<img>` because a sheet holds 64 of
 * them; the cell is selected by offsetting the background. Scaling is done with
 * background-size so the whole thing still works at any em size the fitting
 * pass picks.
 */
export function ItemIcon({ iconId, size = '2.1em', fallback = '' }: Props) {
  const sprites = useSprites();
  const cell = iconId !== undefined ? sprites?.get(iconId) : undefined;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-rule bg-surface-sunken"
      style={{ width: size, height: size }}
      aria-hidden={!cell}
    >
      {cell ? (
        <span
          className="block h-full w-full"
          style={{
            backgroundImage: `url(${cell.url})`,
            // Sized as a multiple of the rendered box so the sheet scales with
            // the icon rather than assuming the 40px it was packed at.
            backgroundSize: `${cell.cols * 100}% ${cell.rows * 100}%`,
            // A percentage background-position aligns that point of the image
            // with the same point of the box; it does not shift by that much.
            // Reaching cell i therefore needs i/(count-1), not -i*100%, which
            // is right only for the first cell and wrong — and backwards — for
            // every other.
            backgroundPosition: `${gridPercent(cell.col, cell.cols)}% ${gridPercent(cell.row, cell.rows)}%`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
        <span
          className="font-display leading-none text-fg-faint select-none"
          style={{ fontSize: '0.38em' }}
        >
          {fallback}
        </span>
      )}
    </span>
  );
}
