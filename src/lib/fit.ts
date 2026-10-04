import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Never smaller than this. At 960px wide the list root is 16px, so the floor
 * puts item names at roughly 7.5px on the card — small, but the card exports at
 * two or three times this size, where it reads fine.
 */
export const MIN_SCALE = 0.56;
/** Never larger than this, or a two-piece outfit sets its names like headlines. */
export const MAX_SCALE = 1.35;
export const BASE_PX = 16;
const PASSES = 8;

export interface Fit {
  boxRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLUListElement | null>;
  /** Multiplier applied to the list's root font size. */
  scale: number;
  /** Extra height the card needs when even MIN_SCALE overflows. */
  extra: number;
}

/**
 * Finds the scale whose measured height best fills the available space, and how
 * much extra height is still needed if even the floor overflows.
 *
 * It searches upward as well as downward. A three-piece outfit that fits at 1.0
 * leaves most of the card empty, so the list grows to meet the bottom; twelve
 * pieces shrink to fit. Either way the list ends flush with the space it was
 * given, which is what stops the card looking half-drawn.
 *
 * Measured rather than calculated: names wrap differently at every size, so row
 * height is a staircase, not a straight line.
 */
export function fitScale(
  measure: (scale: number) => number,
  available: number,
): { scale: number; extra: number } {
  if (available <= 0) return { scale: 1, extra: 0 };

  let lo = MIN_SCALE;
  let hi = MAX_SCALE;
  let best = MIN_SCALE;
  let bestHeight = Infinity;

  for (let i = 0; i < PASSES; i++) {
    const mid = (lo + hi) / 2;
    const height = measure(mid);
    if (height <= available) {
      best = mid;
      bestHeight = height;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (bestHeight <= available) return { scale: best, extra: 0 };
  // Nothing in range fitted; hold the floor and let the card grow instead.
  return { scale: MIN_SCALE, extra: Math.max(0, measure(MIN_SCALE) - available) };
}

/**
 * Keeps the gear list filling its box.
 *
 * Re-measures whenever the content changes, whenever the box resizes, and
 * — critically — once the webfonts have loaded. Measuring before the fonts
 * arrive reads fallback metrics: the text then reflows larger and overflows a
 * box that was measured as fitting, with no second pass to catch it.
 */
export function useFitToBox(signature: string): Fit {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLUListElement | null>(null);
  const extraRef = useRef(0);
  const [fit, setFit] = useState({ scale: 1, extra: 0 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;

    let cancelled = false;

    const run = () => {
      if (cancelled || !boxRef.current || !contentRef.current) return;
      // The box already includes any extra height granted last pass, so remove
      // it to measure against the card's natural size.
      // A hair of slack absorbs sub-pixel rounding between measuring and
      // painting, which is the difference between a clean fit and a clipped
      // final row.
      const available = boxRef.current.clientHeight - extraRef.current - 1;
      const next = fitScale((scale) => {
        const list = contentRef.current!;
        list.style.fontSize = `${scale * BASE_PX}px`;
        // getBoundingClientRect includes fractional height and the last child's
        // bottom margin; scrollHeight rounds down and drops that margin, and
        // across a dozen rows the shortfall is enough to overflow a box the
        // measurement called a fit.
        return Math.ceil(list.getBoundingClientRect().height);
      }, available);
      contentRef.current.style.fontSize = '';
      extraRef.current = next.extra;
      setFit((prev) =>
        Math.abs(prev.scale - next.scale) < 0.002 && prev.extra === next.extra ? prev : next,
      );
    };

    run();

    // Webfonts almost always resolve after first paint.
    document.fonts?.ready.then(run);

    // Catches the card changing shape, and any late reflow the fonts promise
    // does not cover.
    const observer = new ResizeObserver(run);
    observer.observe(box);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [signature]);

  return { boxRef, contentRef, ...fit };
}
