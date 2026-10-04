import { UI_SLOTS } from '../scripts/slots.ts';
import { encodeCard, decodeCard, type SharedCard } from '../src/lib/share.ts';

/**
 * Exercises the share encoding.
 *
 *   npm run check:share
 *
 * A link is the one artefact this project produces that has to keep working
 * after the code changes: someone posts an outfit today and a stranger opens it
 * next month against a newer build. So this checks three things — that a card
 * survives a round trip unchanged, that links stay short enough to paste, and
 * that a fixed sample string still decodes, which is what catches an
 * accidental change to the byte layout.
 */

// btoa/atob exist in Node, but shareUrl reaches for window.
(globalThis as { window?: unknown }).window ??= { location: { href: 'https://x.test/' } };

const TEMPLATES = ['plain', 'editorial', 'masthead', 'spread'];
const SLOTS = UI_SLOTS.map((s) => s.id as string);

/**
 * A link produced by the current format, kept as a literal. If the byte layout
 * changes without the version being bumped, this stops decoding — which is the
 * moment every link already in the wild would have broken.
 */
const SAMPLE = {
  encoded:
    'ARAM2cACAQbfzQIVAAEAAAEhABDtmZTsnbTtirgg66Gc7KaICeujqOyyuO2KuAnrqqjqt7jrpqwM67Cx66eI64-E7IKs',
  expect: {
    title: '화이트 로즈',
    characterName: '루첸트',
    world: '모그리',
    job: '백마도사',
    pieces: 3,
  },
};

let failures = 0;
const note = (ok: boolean, label: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

function makeRng(seed: number) {
  let state = seed;
  return () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function randomCard(rng: () => number): SharedCard {
  const pick = <T,>(values: T[]): T => values[Math.floor(rng() * values.length)];
  return {
    slots: SLOTS.filter(() => rng() > 0.35).map((slot) => ({
      slot,
      itemId: 1 + Math.floor(rng() * 52659),
      dyes: [
        rng() > 0.5 ? 1 + Math.floor(rng() * 125) : null,
        rng() > 0.7 ? 1 + Math.floor(rng() * 125) : null,
      ] as [number | null, number | null],
    })),
    templateId: pick(TEMPLATES),
    layout: pick(['square', 'landscape', 'wide'] as const),
    dyeStyle: pick(['swatch', 'text'] as const),
    cardTheme: pick(['auto', 'light', 'dark'] as const),
    showSubNames: rng() > 0.5,
    cardLang: pick(['auto', 'ko', 'ja', 'en'] as const),
    meta: {
      title: pick(['', '화이트 로즈', 'ネオクイーン', 'A rather long outfit name', '🌸 벚꽃']),
      characterName: pick(['', '루첸트', 'Lucent Aurora']),
      world: pick(['', '모그리', 'Chocobo']),
      job: pick(['', '백마도사', 'White Mage']),
    },
  };
}

console.log('\n  round trip');
const rng = makeRng(20260828);
let mismatches = 0;
let longest = 0;
let total = 0;
for (let i = 0; i < 5000; i++) {
  const card = randomCard(rng);
  const encoded = encodeCard(card, TEMPLATES);
  longest = Math.max(longest, encoded.length);
  total += encoded.length;
  if (JSON.stringify(decodeCard(encoded, TEMPLATES)) !== JSON.stringify(card)) mismatches++;
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) mismatches++;
}
note(mismatches === 0, `5000 random cards survive unchanged${mismatches ? ` (${mismatches} failed)` : ''}`);
console.log(`    average ${Math.round(total / 5000)} chars, longest ${longest}`);

console.log('\n  length');
const full: SharedCard = {
  slots: SLOTS.map((slot) => ({ slot, itemId: 52659, dyes: [125, 125] })),
  templateId: 'spread',
  layout: 'wide',
  dyeStyle: 'text',
  cardTheme: 'dark',
  showSubNames: true,
  cardLang: 'ja',
  meta: {
    title: '아주 긴 코디명을 넣어보는 경우입니다',
    characterName: 'Lucent Aurora',
    world: '모그리',
    job: '백마도사',
  },
};
const fullLength = encodeCard(full, TEMPLATES).length;
// Well inside every practical limit; the point is to notice if the format ever
// starts growing unreasonably.
note(fullLength < 400, `worst case is ${fullLength} chars`);
note(decodeCard(encodeCard(full, TEMPLATES), TEMPLATES)?.slots.length === 14, 'all 14 slots survive');

console.log('\n  malformed input');
const junk = ['', 'x', '!!!!', 'AAAA', 'A'.repeat(500), 'Zm9vYmFy', '../../etc/passwd'];
note(
  junk.every((value) => {
    try {
      const result = decodeCard(value, TEMPLATES);
      return result === null || typeof result === 'object';
    } catch {
      return false;
    }
  }),
  `${junk.length} malformed inputs return null instead of throwing`,
);

console.log('\n  format stability');
const decoded = decodeCard(SAMPLE.encoded, TEMPLATES);
note(decoded !== null, 'the stored sample link still decodes');
if (decoded) {
  note(decoded.meta.title === SAMPLE.expect.title, `title reads "${decoded.meta.title}"`);
  note(decoded.meta.characterName === SAMPLE.expect.characterName, 'character survives');
  note(decoded.meta.world === SAMPLE.expect.world, 'world survives');
  note(decoded.meta.job === SAMPLE.expect.job, 'job survives');
  note(decoded.slots.length === SAMPLE.expect.pieces, `${decoded.slots.length} pieces`);
}

console.log('\n  slot identity');
// Facewear and fashion ids overlap the Item sheet's, so position in the mask is
// the only thing that distinguishes them.
const collide: SharedCard = {
  ...full,
  slots: [
    { slot: 'head', itemId: 1, dyes: [null, null] },
    { slot: 'facewear', itemId: 1, dyes: [null, null] },
    { slot: 'ornament', itemId: 1, dyes: [null, null] },
  ],
};
const back = decodeCard(encodeCard(collide, TEMPLATES), TEMPLATES);
note(
  back?.slots.map((s) => s.slot).join() === 'head,facewear,ornament',
  'the same id in three sheets stays distinguishable',
);

if (failures) {
  console.error(`\n  ${failures} problem(s) with the share format.`);
  process.exit(1);
}
console.log('\n  share format sound');
