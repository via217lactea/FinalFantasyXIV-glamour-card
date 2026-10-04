import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

/**
 * Builds preview/template.jsx into a single self-contained artifact, then
 * renders it with a populated card and asserts on the output.
 *
 * The assertions exist because the preview is plain JSX with no type checking.
 * The real app caught a stale `dens.pad` reference at compile time; the preview
 * silently rendered `width: undefined` instead. Anything that only appears once
 * a slot is filled has to be checked against a filled slot.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const OUT = process.argv[2] ?? join(root, 'dist-preview', 'glamour-card-preview.jsx');

const template = readFileSync(join(here, 'template.jsx'), 'utf8');
const data = readFileSync(join(here, 'sample-data.json'), 'utf8');

if (!template.includes('/*__DATA__*/')) {
  throw new Error('template.jsx no longer has the /*__DATA__*/ placeholder');
}

const bundle = template.replace('/*__DATA__*/', data);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, bundle);
console.log(`▸ built ${OUT}  (${(bundle.length / 1024).toFixed(0)} KB)`);

// --- verify --------------------------------------------------------------
const scratch = mkdtempSync(join(tmpdir(), 'preview-'));
const entry = join(scratch, 'entry.jsx');
const compiled = join(root, 'node_modules', '.preview-check.mjs');
writeFileSync(entry, bundle);

execFileSync(
  'npx',
  ['esbuild', entry, '--jsx=automatic', '--format=esm', '--bundle',
   '--external:react', '--external:react/jsx-runtime', `--outfile=${compiled}`],
  { cwd: root, stdio: 'pipe' },
);

const { default: Preview } = await import(compiled);

/** Two dyed pieces, so multilingual names and both dye channels are exercised. */
const seed = (catalog, stains) => ({
  head: { item: catalog.head[0], dyes: [stains[0], stains[5]] },
  body: { item: catalog.body[0], dyes: [stains[20], null] },
});

/**
 * Every slot filled. A card is at its tightest here, and a two-piece seed will
 * never reveal a row that does not shrink — which is how an overflow bug
 * survived two rounds of these checks.
 */
const fullSeed = (catalog, stains) => {
  const pairs = [
    ['mainhand', 'mainhand'], ['offhand', 'offhand'], ['head', 'head'], ['body', 'body'],
    ['hands', 'hands'], ['legs', 'legs'], ['feet', 'feet'], ['earrings', 'earrings'],
    ['necklace', 'necklace'], ['bracelets', 'bracelets'], ['ring1', 'ring'], ['ring2', 'ring'],
    ['facewear', 'facewear'], ['ornament', 'ornament'],
  ];
  const out = {};
  pairs.forEach(([slot, source], i) => {
    const item = catalog[source]?.[i % (catalog[source]?.length || 1)];
    if (!item) return;
    out[slot] = {
      item,
      dyes: item.dyeCount >= 2 ? [stains[i % stains.length], stains[(i + 7) % stains.length]]
        : item.dyeCount === 1 ? [stains[i % stains.length], null]
        : [null, null],
    };
  });
  return out;
};

// Each template needs its own render: only one of them is the default, and a
// change to the other would otherwise sail through every check.
const render = (props) => renderToString(createElement(Preview, { __seed: seed, ...props }));

// A 1x1 gif. The screenshot branch of every template only renders when an
// image is set, so without this the img path is never exercised — which is how
// an undefined variable in it shipped once already.
const PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const html = render({ __style: 'plain' });
const visible = html.replace(/<[^>]*>/g, '\n');
const editorialHtml = render({ __style: 'editorial', __dyeStyle: 'text' });
const editorialSwatchHtml = render({ __style: 'editorial' });
const mastheadHtml = render({ __style: 'masthead' });
const spreadHtml = render({ __style: 'spread' });

const checks = [
  ['item name', () => visible.includes(sampleName('head'))],
  ['other-language names', () => / \/ /.test(visible)],
  ['dye channel 1', () => visible.includes('1') && visible.includes(stainName(0))],
  ['dye channel 2', () => visible.includes(stainName(5))],
  ['patch version', () => visible.includes('7.5') || visible.includes('패치')],
  // React omits undefined style properties entirely, so scanning the output for
  // "undefined" proves nothing. What is checkable is that rows carry the em
  // metrics they should, which is what makes the fit-to-height scaling work.
  ['rows sized in em', () => /font-size:0\.8125em/.test(html) && /font-size:0\.594em/.test(html)],
  ['list root is scaled', () => /font-size:16px/.test(html)],
  // Fixed height is the point: the list shrinks to fit rather than the card
  // stretching. A min-height here would mean the fitting never engaged.
  ['card height is fixed', () => /height:\d+px/.test(html) && !/min-height:\d+px/.test(html)],
  ['display stage scales', () => /transform:scale\(/.test(html)],
  // Facewear and fashion accessories come from separate sheets, so a pipeline
  // change can drop them without breaking anything else.
  ['facewear slot listed', () => visible.includes('안경')],
  ['fashion slot listed', () => visible.includes('패션 아이템')],
  ['reset control', () => visible.includes('전체 초기화')],
  // Every field the reset promises to clear has to be listed in the handler.
  // Checking only that the button exists is what let a broken reset ship.
  ['reset clears every field', () => {
    const body = /function resetAll\(\)[\s\S]*?\n  \}/.exec(bundle)?.[0] ?? '';
    return [
      'setSlots', 'setMeta', 'setImage', 'setFocus', 'setZoom',
      'setLayout', 'setCardTheme', 'setCardStyle', 'setDyeStyle',
      'setSubNames', 'setCardLangPref',
    ].every((setter) => body.includes(setter));
  }],
  // window.confirm, alert and prompt are suppressed in sandboxed frames: the
  // call returns undefined and any code gated on it silently never runs. That
  // is exactly how the reset button stopped working.
  ['no blocking dialogs', () => !/\b(?:window\.)?(?:confirm|alert|prompt)\s*\(/.test(
    bundle.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''),
  )],
  // Trim marks and the barcode are generated geometry — an external image would
  // silently vanish from the PNG export.
  ['editorial draws a barcode', () => /<rect [^>]*opacity="0\.82"/.test(editorialHtml)],
  ['editorial has no external assets', () => !/<img[^>]+src="https?:|url\(https?:/.test(editorialHtml)],
  ['editorial barcode is stable', () => {
    const again = render({ __style: 'editorial', __dyeStyle: 'text' });
    const bars = (h) => (h.match(/<rect [^>]*opacity="0\.82"[^>]*>/g) ?? []).join();
    return bars(again) === bars(editorialHtml) && bars(editorialHtml).length > 0;
  }],
  // Dyes are set as text here, not swatches — that is the whole look.
  ['editorial sets dyes as text', () => editorialHtml.includes('|')
    && /하얀 눈색/.test(editorialHtml.replace(/<[^>]*>/g, '\n'))],
  ['editorial keeps the required credit', () => editorialHtml.includes('SQUARE ENIX')],
  // Dye display is independent of the template, so both combinations matter.
  ['dye swatches work in editorial', () => /background:#/.test(editorialSwatchHtml)],
  // The masthead only reads as one at display size in a Didone; a fallback to
  // the body serif would quietly ruin it.
  ['masthead uses the didone', () => mastheadHtml.includes('Bodoni Moda')],
  // The title face is Plex. It must not reach the gear list: Plex splits by
  // script and its KR and JP faces sit on different baselines, so a row mixing
  // hangul with kana would show them at different heights.
  ['title face in every template', () => ['plain', 'editorial', 'masthead', 'spread']
    .every((style) => render({ __style: style }).includes('IBM Plex Sans'))],
  ['title face stays out of the list', () => ['plain', 'editorial', 'masthead', 'spread']
    .every((style) => {
      const html = render({ __style: style });
      const list = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'));
      return list.length > 0 && !list.includes('IBM Plex');
    })],
  ['masthead draws its rules', () => mastheadHtml.includes('Fashion Collection')
    && mastheadHtml.includes('First Look')],
  // The screenshot's place is held open even when empty, so the layout the card
  // will have is visible before uploading.
  ['image slot is reserved', () => ['plain', 'editorial', 'masthead', 'spread'].every((style) =>
    render({ __style: style }).includes('스크린샷이 들어갈 자리'))],
  // A card-wide colour bar competed with the screenshot; only per-piece dyes
  // and the count remain.
  // The card used to stay Korean when the interface switched, because the card
  // language was a separate setting that defaulted to ko rather than following.
  ['card labels follow the interface', () => {
    const en = render({ __style: 'plain', __uiLang: 'en' }).replace(/<[^>]*>/g, '\n');
    const ja = render({ __style: 'plain', __uiLang: 'ja' }).replace(/<[^>]*>/g, '\n');
    return en.includes('Appearance') && en.includes('pieces')
      && ja.includes('外見情報') && !en.includes('외형 정보');
  }],
  ['editorial labels follow too', () => {
    // The model label only appears once a character name is set, so the check
    // has to look at a label that is always drawn.
    const en = render({ __style: 'editorial', __uiLang: 'en' }).replace(/<[^>]*>/g, '\n');
    const ko = render({ __style: 'editorial', __uiLang: 'ko' }).replace(/<[^>]*>/g, '\n');
    return en.includes('Glamour Collection') && !en.includes('글래머')
      && ko.includes('글래머');
  }],
  // The outfit name leads the lookbook header; the model and the world step
  // down from there.
  ['editorial leads with the outfit name', () => {
    const html = render({ __style: 'editorial', __uiLang: 'ko' });
    const text = html.replace(/<[^>]*>/g, '\n');
    const collection = text.indexOf('글래머 컬렉션');
    const untitled = text.indexOf('이름 없는 코디');
    return collection >= 0 && untitled > collection;
  }],
  // Every template must carry the full notice, not an abbreviation.
  ['full copyright notice', () => ['plain', 'editorial', 'masthead', 'spread'].every((style) => {
    const html = render({ __style: style });
    return html.includes('FINAL FANTASY XIV') && html.includes('SQUARE ENIX');
  })],
  // With no dyes the bar still has to read as a density strip.
  // With dyes the bar runs through them; with none it falls back to a
  // black-to-white density strip, so both paths are rendered.
  ['masthead bar uses the dyes', () => mastheadHtml.includes('linear-gradient')
    && /linear-gradient\(to right, #[0-9a-f]{6}, #[0-9a-f]{6}/.test(mastheadHtml)
    && !mastheadHtml.includes('#111111')],
  ['masthead bar falls back to black-white', () =>
    renderToString(createElement(Preview, { __style: 'masthead' })).includes('#111111')],
  ['editorial has corner rules', () => editorialHtml.includes('<line')],
  // Renders every template with a screenshot present, at a zoom other than 1,
  // so the image branch and its transform are actually executed.
  // Fourteen slots is the worst case the fitting pass has to survive.
  ['full outfit renders every slot', () =>
    ['plain', 'editorial', 'masthead', 'spread'].every((style) => {
      const html = renderToString(createElement(Preview, { __seed: fullSeed, __style: style }));
      const list = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'));
      return (list.match(/<li/g) ?? []).length === 14;
    })],
  // Nothing inside a row may be sized in px: the fitting pass scales the list by
  // changing its font-size, and a pixel value silently refuses to follow — the
  // measured height then disagrees with what renders and rows overflow. The
  // list's own root font-size is the one legitimate px value, since that is the
  // number being scaled.
  // A long outfit must fold, not just shrink: the dye names move onto the
  // secondary line, then the secondary line moves up beside the name. Without
  // this the type has to go below readable size to fit ten rows on 16:9.
  ['long outfits fold their rows', () => {
    const full = renderToString(createElement(Preview, { __seed: fullSeed, __style: 'masthead' }));
    const list = full.slice(full.indexOf('<ul'), full.indexOf('</ul>'));
    // At 14 pieces every row is one line: no standalone secondary paragraph.
    const rows = list.split('<li').slice(1);
    return rows.length === 14 && rows.every((row) => (row.match(/<p/g) ?? []).length === 1);
  }],
  ['short outfits keep their lines', () => {
    const two = renderToString(createElement(Preview, { __seed: seed, __style: 'masthead' }));
    const list = two.slice(two.indexOf('<ul'), two.indexOf('</ul>'));
    const rows = list.split('<li').slice(1);
    return rows.length === 2 && rows.some((row) => (row.match(/<p/g) ?? []).length >= 3);
  }],
  ['row sizes only in em', () =>
    ['plain', 'editorial', 'masthead', 'spread'].every((style) => {
      const html = renderToString(createElement(Preview, { __seed: fullSeed, __style: style }));
      const list = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'));
      const rows = list.slice(list.indexOf('<li'));
      const px = rows.match(/(?:width|height|font-size|min-width):\s*\d+(?:\.\d+)?px/g) ?? [];
      return rows.length > 0 && px.length === 0;
    })],
  ['screenshot renders in every template', () =>
    ['plain', 'editorial', 'masthead', 'spread'].every((style) => {
      const withImage = render({ __style: style, __image: PIXEL, __zoom: 1.6 });
      return withImage.includes('<img') && withImage.includes('scale(1.6)');
    })],
  // The paper texture is meant to be a whisper. It once shipped at full
  // strength because the element carried the image as well as the overlay,
  // which on a dark ground looked like television static.
  ['paper grain stays faint', () => {
    const opacities = [...bundle.matchAll(/filter='url\(%23f\)' opacity='([\d.]+)'/g)]
      .map((m) => Number(m[1]));
    const bare = /filter='url\(%23f\)'\s*\/%3E/.test(bundle);
    return opacities.length > 0 && opacities.every((o) => o <= 0.05) && !bare;
  }],
  ['no card-wide dye bar', () => {
    const bars = (h) => (h.match(/flex:1;background:#[0-9a-f]{6}/g) ?? []).length;
    return ['plain', 'editorial', 'masthead', 'spread'].every((style) => bars(render({ __style: style })) === 0);
  }],
  // The ruled setting box is what carries this layout; losing it would leave a
  // generic list on a white page.
  ['spread draws the ruled box', () => spreadHtml.includes('Firstlook')
    && spreadHtml.includes('SQUARE ENIX')],
  ['spread pairs didone with a grotesque', () => spreadHtml.includes('Bodoni Moda')
    && spreadHtml.includes('EORZEA FASHION')],
];

function sampleName(slot) {
  return JSON.parse(data).items[slot][0][4]; // ko name
}
function stainName(index) {
  return JSON.parse(data).stains[index][3]; // ko name
}

let failed = 0;
for (const [label, run] of checks) {
  const ok = run();
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
}

rmSync(scratch, { recursive: true, force: true });
rmSync(compiled, { force: true });

if (failed) {
  console.error(`\n${failed} preview check(s) failed — the artifact renders, but not correctly.`);
  process.exit(1);
}
