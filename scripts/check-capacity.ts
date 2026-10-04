import { MIN_SCALE, BASE_PX } from '../src/lib/fit.ts';
import { LAYOUTS } from '../src/store/card.ts';

/**
 * Works out how many gear rows each template can hold, without a browser.
 *
 * This is only possible because every dimension inside a row is expressed in em:
 * row height is therefore exactly proportional to the list's font size, and the
 * whole layout reduces to arithmetic. A px value anywhere in a row would break
 * both this model and the fitting pass itself.
 *
 *   npm run check:capacity
 */

const CARD_WIDTH = 960;
/** Tailwind's leading-snug. */
const SNUG = 1.375;

/** Em heights of the pieces a row can contain. */
const ROW = {
  padY: 0.8, // py-[0.4em] top and bottom
  name: 0.8125 * SNUG,
  sub: 0.625 * SNUG,
  /** A dye tag on its own line: the tag plus the margin above it. */
  dyeBlock: 0.3 + (0.594 * 1.4 + 0.15 * 2),
  /** Dye names folded into the secondary line cost nothing extra. */
  dyeInline: 0,
  /** Gap between rows, which the design templates set per template. */
  gap: 0.5,
  icon: 2.1,
};

/** Fixed vertical furniture each template spends before the list starts. */
const CHROME: Record<string, { top: number; bottom: number; label: string }> = {
  plain: { top: 130, bottom: 47, label: '머리말 + 이중 괘선, 바닥글' },
  editorial: { top: 96 + 58, bottom: 66 + 58, label: '트림 여백, 모델 블록, 크레딧' },
  masthead: { top: 226, bottom: 56, label: '제호, 사이즈 태그, 염색 바, 바코드' },
  spread: { top: 178, bottom: 28, label: '제호, 괘선 박스, 부제' },
};

function rowEm(opts: { sub: boolean; dyes: boolean; density: 0 | 1 | 2; icon: boolean }): number {
  const text =
    ROW.name +
    (opts.sub && opts.density < 2 ? ROW.sub : 0) +
    (opts.dyes && opts.density < 1 ? ROW.dyeBlock : 0);
  // Only the plain template puts an icon beside the text; the others are type
  // only, so the icon cannot be the floor there.
  return ROW.padY + Math.max(text, opts.icon ? ROW.icon : 0);
}

function capacity(
  template: string,
  layout: keyof typeof LAYOUTS,
  opts: { sub: boolean; dyes: boolean; density: 0 | 1 | 2 },
) {
  const cardHeight = CARD_WIDTH / LAYOUTS[layout].ratio;
  const chrome = CHROME[template];
  const available = cardHeight - chrome.top - chrome.bottom;
  const icon = template === 'plain';
  const gap = icon ? 0 : ROW.gap;
  const rowPx = (rowEm({ ...opts, icon }) + gap) * BASE_PX * MIN_SCALE;
  return { rows: Math.floor(available / rowPx), available: Math.round(available), rowPx: Math.round(rowPx) };
}

const TARGET: Record<string, number> = { plain: 13, editorial: 10, masthead: 10, spread: 10 };

let failed = 0;
for (const layout of ['square', 'landscape', 'wide'] as const) {
  console.log(`\n  ${layout}  (${CARD_WIDTH}×${Math.round(CARD_WIDTH / LAYOUTS[layout].ratio)})`);
  console.log('  ' + '-'.repeat(66));
  for (const template of Object.keys(CHROME)) {
    // The worst case a person can actually produce: other-language names on,
    // every piece dyed.
    const loose = capacity(template, layout, { sub: true, dyes: true, density: 0 });
    const folded = capacity(template, layout, { sub: true, dyes: true, density: 1 });
    const tight = capacity(template, layout, { sub: true, dyes: true, density: 2 });
    const best = tight.rows;
    const target = TARGET[template];
    // Only the widest shape has to hit the target; a square card is taller and
    // will always do better, a 16:9 one is the squeeze.
    const ok = layout !== 'wide' || best >= target;
    if (!ok) failed++;
    console.log(
      `  ${ok ? '✓' : '✗'} ${template.padEnd(11)}` +
        `여유 ${String(loose.available).padStart(4)}px  ` +
        `밀도0 ${String(loose.rows).padStart(2)}개  ` +
        `밀도1 ${String(folded.rows).padStart(2)}개  ` +
        `밀도2 ${String(tight.rows).padStart(2)}개  ` +
        `(목표 ${target})`,
    );
  }
}

console.log(
  '\n  밀도1은 염색 이름을 보조 줄로, 밀도2는 보조 줄까지 이름 옆으로 접는다.\n' +
    '  임계값은 src/components/CardPreview.tsx 의 density 계산과 맞춰야 한다.',
);
if (failed) {
  console.error(`\n  ${failed}개 템플릿이 16:9에서 목표에 미달한다.`);
  process.exit(1);
}
