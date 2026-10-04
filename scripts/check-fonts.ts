/**
 * Measures what a font actually costs to load.
 *
 *   npm run check:fonts
 *   npm run check:fonts -- "Nanum Myeongjo:wght@400;700"
 *
 * Korean faces are the reason this exists. A full hangul set is thousands of
 * glyphs, and the difference between a well-subsetted face and a naive one is
 * the difference between 40 KB and several MB on first paint. Google Fonts
 * splits its Korean faces into unicode-range chunks and the browser fetches
 * only what the page uses, so the honest number is not the total — it is the
 * few chunks that carry common syllables plus the latin block.
 *
 * Anything on this list must be SIL OFL or equivalent: the PNG export inlines
 * font data into the SVG it rasterises, so a licence permitting a webfont link
 * but not embedding cannot be used.
 */

const DEFAULT_CANDIDATES = [
  'Gowun Batang:wght@400;700',
  'Gowun Dodum',
  'Noto Sans KR:wght@400;700',
  'Noto Serif KR:wght@400;700',
  'Nanum Myeongjo:wght@400;700',
  'Nanum Gothic:wght@400;700',
  'IBM Plex Sans KR:wght@400;700',
  'Song Myung',
  'Bodoni Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700',
];

/** Google serves woff2 only to browsers that advertise support. */
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

interface Chunk {
  url: string;
  bytes: number;
  /** The unicode-range this chunk covers, when the stylesheet declares one. */
  range: string | null;
}

async function measure(spec: string): Promise<{ chunks: Chunk[]; korean: number; latin: number }> {
  const family = spec.replace(/ /g, '+');
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`, {
    headers: { 'user-agent': UA },
  });
  if (!res.ok) throw new Error(`${res.status} for ${spec}`);
  const css = await res.text();

  // Each @font-face block pairs a src url with the range it serves.
  const blocks = css.split('@font-face').slice(1);
  const chunks: Chunk[] = [];

  await Promise.all(
    blocks.map(async (block) => {
      const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
      if (!url) return;
      const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim() ?? null;
      const head = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA } });
      chunks.push({ url, range, bytes: Number(head.headers.get('content-length') ?? 0) });
    }),
  );

  // U+AC00–D7A3 is the hangul syllable block; U+0000–00FF is basic latin.
  const isKorean = (c: Chunk) => c.range?.toUpperCase().includes('AC00') ?? false;
  const isLatin = (c: Chunk) => /U\+0{0,3}0-0*FF/i.test(c.range ?? '');

  return {
    chunks,
    korean: chunks.filter(isKorean).reduce((sum, c) => sum + c.bytes, 0),
    latin: chunks.filter(isLatin).reduce((sum, c) => sum + c.bytes, 0),
  };
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

async function main() {
  const specs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CANDIDATES;

  console.log('  family'.padEnd(46) + 'chunks    latin   hangul     total');
  console.log('  ' + '-'.repeat(74));

  for (const spec of specs) {
    const name = spec.split(':')[0];
    try {
      const { chunks, korean, latin } = await measure(spec);
      const total = chunks.reduce((sum, c) => sum + c.bytes, 0);
      console.log(
        '  ' +
          name.padEnd(44) +
          String(chunks.length).padStart(6) +
          kb(latin).padStart(9) +
          (korean ? kb(korean) : '—').padStart(9) +
          kb(total).padStart(10),
      );
    } catch (err) {
      console.log('  ' + name.padEnd(44) + `  ${(err as Error).message}`);
    }
  }

  console.log(
    '\n  "hangul" is the U+AC00–D7A3 chunk — the one a Korean page actually pulls.\n' +
      '  "total" is every chunk together, which no single page downloads.\n' +
      '  Check the licence before adding anything: it must permit embedding.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
