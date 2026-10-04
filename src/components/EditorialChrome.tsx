import { useMemo } from 'react';

/**
 * Print-proof furniture for the editorial card: trim marks and a barcode.
 *
 * Both are generated geometry rather than assets — the PNG exporter cannot
 * fetch anything external, so an image file here would simply vanish from the
 * saved card.
 */

/** Content has to clear the trim marks. */
export const EDITORIAL_INSET = 58;

const MARK = { offset: 22, length: 34, gap: 12 };

export function TrimMarks() {
  const { offset, length, gap } = MARK;
  const corners = [
    { x: 0, y: 0, sx: 1, sy: 1 },
    { x: 1, y: 0, sx: -1, sy: 1 },
    { x: 0, y: 1, sx: 1, sy: -1 },
    { x: 1, y: 1, sx: -1, sy: -1 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {corners.map((c, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            [c.x ? 'right' : 'left']: 0,
            [c.y ? 'bottom' : 'top']: 0,
            width: offset + length,
            height: offset + length,
          }}
        >
          {/* Two lines meeting near, but not at, the corner — the way a printer
              marks where the sheet gets cut. */}
          <span
            className="absolute bg-fg-faint/45"
            style={{
              [c.x ? 'right' : 'left']: offset,
              [c.y ? 'bottom' : 'top']: gap,
              width: 1,
              height: length,
            }}
          />
          <span
            className="absolute bg-fg-faint/45"
            style={{
              [c.x ? 'right' : 'left']: gap,
              [c.y ? 'bottom' : 'top']: offset,
              height: 1,
              width: length,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * A weight bar in the colours the outfit actually uses, run left to right as a
 * gradient. With no dyes it falls back to black-to-white, which is what a print
 * proof carries as a density strip.
 */
export function DyeBar({ colors, className = '' }: { colors: string[]; className?: string }) {
  const stops = colors.length >= 2 ? colors : colors.length === 1 ? [colors[0], '#ffffff'] : ['#111111', '#ffffff'];
  return (
    <div
      className={className}
      style={{ backgroundImage: `linear-gradient(to right, ${stops.join(', ')})` }}
    />
  );
}

/** A hairline run diagonally across a corner, the way a proof sheet is marked. */
export function CornerRules() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1="0" y1="76" x2="76" y2="0" className="stroke-fg-faint" strokeWidth="0.75" opacity="0.5" />
      <line x1="0" y1="112" x2="112" y2="0" className="stroke-fg-faint" strokeWidth="0.75" opacity="0.3" />
      <line
        x1="100%" y1="calc(100% - 76px)" x2="calc(100% - 76px)" y2="100%"
        className="stroke-fg-faint" strokeWidth="0.75" opacity="0.5"
      />
    </svg>
  );
}

/** Deterministic, so the bars do not reshuffle on every keystroke. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decorative only — it encodes nothing and is not meant to scan. */
export function Barcode({ label, width = 104, height = 40 }: { label: string; width?: number; height?: number }) {
  const bars = useMemo(() => {
    // Seeded from the label so different outfits get visibly different bars.
    let seed = 0x1f2e;
    for (const ch of label) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const random = mulberry32(seed);
    const out: { x: number; w: number }[] = [];
    let x = 0;
    while (x < width - 2) {
      const w = random() < 0.28 ? 3 : random() < 0.5 ? 2 : 1;
      out.push({ x, w });
      x += w + (random() < 0.4 ? 2 : 1);
    }
    return out;
  }, [label, width]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} className="fill-fg" opacity="0.82" />
      ))}
    </svg>
  );
}
