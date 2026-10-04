import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONTS } from '../src/lib/fonts.ts';

/**
 * Guards the chain that makes text survive the PNG export.
 *
 *   npm run check:export
 *
 * The exporter serialises the card into an SVG and rasterises it in isolation,
 * so a font referenced by URL is simply unreachable at that point. Its bytes
 * have to be inlined first, and that only happens for stylesheets the exporter
 * knows to fetch. Three things therefore have to agree:
 *
 *   1. every family in the registry is actually loaded by the page
 *   2. every font stylesheet the page loads is matched by the exporter's filter
 *   3. every font token resolves to a family that exists
 *
 * When they drift the failure is silent and total: Korean renders as tofu boxes
 * in the saved file while looking perfect on screen.
 *
 * The paper texture is checked here too, since it is the other thing that only
 * shows up once rendered.
 */

/** Faces that ship with an operating system and are never downloaded. */
const SYSTEM_FACES = new Set(['SF Mono', 'Menlo', 'Consolas', 'Pretendard']);

const root = process.cwd();
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'src', 'index.css'), 'utf8');
const exporter = readFileSync(join(root, 'src', 'lib', 'export.ts'), 'utf8');

/** The regex the exporter uses to decide which stylesheets to inline. */
const filterSource = /\/(fonts\\\.googleapis\\\.com\|pretendard)\//.exec(exporter)
  ? /fonts\.googleapis\.com|pretendard/
  : null;

const failures: string[] = [];
const note = (ok: boolean, label: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures.push(label);
};

console.log('\n  registry → page');
for (const font of FONTS) {
  // Match the family by name, not by host: several families come from the same
  // stylesheet host, so a host check passes even after one has been dropped
  // from the URL. Pretendard's build names its family differently from its
  // path, hence the second form.
  const slug = font.family.replace(/ /g, '+');
  const stem = font.family.toLowerCase().replace(/ /g, '');
  const loaded = html.includes(slug) || html.toLowerCase().includes(stem.replace('variable', ''));
  note(loaded, `${font.family} is loaded`);
}

console.log('\n  page → exporter');
const stylesheets = [...html.matchAll(/<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"/g)]
  .concat([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)])
  .map((m) => m[1]);
const fontSheets = stylesheets.filter((href) => /font|pretendard/i.test(href));

note(fontSheets.length > 0, `found ${fontSheets.length} font stylesheet(s)`);
note(Boolean(filterSource), 'exporter declares a stylesheet filter');
for (const href of fontSheets) {
  note(Boolean(filterSource?.test(href)), `exporter will inline ${hostStem(href)}`);
}

console.log('\n  tokens → families');
const families = new Set(FONTS.map((f) => f.family));
for (const [, token, stack] of css.matchAll(/(--font-[a-z]+):\s*([^;]+);/g)) {
  const first = /'([^']+)'/.exec(stack)?.[1];
  if (!first) continue; // an unquoted system stack needs no embedding
  // A token may lead with a system face — the mono stack starts with SF Mono,
  // which ships with macOS and is never downloaded. What matters is that the
  // token does not depend on a webfont the exporter has never heard of.
  const quoted = [...stack.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const webfonts = quoted.filter((family) => !SYSTEM_FACES.has(family));
  if (webfonts.length === 0) {
    console.log(`  · ${token} → system stack, nothing to embed`);
    continue;
  }
  note(
    webfonts.every((family) => families.has(family)),
    `${token} → ${webfonts.join(', ')}`,
  );
  void first;
}

function hostStem(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

console.log('\n  paper texture');
// The grain belongs on the overlay only. Putting the same image on .paper
// itself paints it at full strength with no opacity to dim it, and the overlay
// then stacks a second copy on top — which on a dark ground reads as static.
const paperRule = /\.paper\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
note(!paperRule.includes('background-image'), '.paper carries no background of its own');
note(/\.paper::before\s*\{[^}]*background-image/.test(css), 'the overlay carries the texture');
for (const [, value] of css.matchAll(/--c-grain:\s*([\d.]+);/g)) {
  note(Number(value) <= 0.05, `grain opacity ${value}`);
}

if (failures.length) {
  console.error(`\n  ${failures.length} problem(s) with the export chain:`);
  for (const failure of failures) console.error(`    - ${failure}`);
  process.exit(1);
}
console.log('\n  export chain intact');
