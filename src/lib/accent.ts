import { useEffect } from 'react';
import type { Stain } from './catalog.ts';

function hsl(hex: string): { s: number; l: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/**
 * Picks the dye that best carries the outfit's identity: saturated, and mid
 * enough in lightness to read as an accent against the surface. A set dyed
 * entirely in Soot Black yields nothing, and the theme's own fallback stands in.
 */
export function accentFrom(strip: Stain[]): string | null {
  let best: string | null = null;
  let bestScore = 0.18;
  for (const stain of strip) {
    const { s, l } = hsl(stain.hex);
    const score = s * (1 - Math.abs(l - 0.55) * 1.6);
    if (score > bestScore) {
      bestScore = score;
      best = stain.hex;
    }
  }
  return best;
}

/** Publishes the accent as a CSS variable so plain CSS can use it too. */
export function useAccent(strip: Stain[]): string | null {
  const accent = accentFrom(strip);
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--accent',
      accent ?? 'var(--fallback-accent)',
    );
  }, [accent]);
  return accent;
}
