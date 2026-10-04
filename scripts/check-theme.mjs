import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolves the custom-property chain the way a browser does, to prove a card
 * can carry a theme different from the page.
 *
 *   npm run check:theme
 *
 * The subtlety this guards: a var() inside a custom property is substituted
 * where that property is DECLARED, and the resolved value is what inherits.
 * Declaring the palette aliases only at :root therefore freezes the page's
 * palette into them, and a card that sets data-theme on itself changes the raw
 * --c-* values for its subtree while the aliases never look again. The card
 * then silently follows the page. Nothing about that is visible in the source;
 * it only shows up rendered.
 */

const dir = join(process.cwd(), 'dist', 'assets');
const css = readdirSync(dir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

/** Declarations from every rule whose selector list contains `selector`. */
function declarations(selector) {
  const out = {};
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    for (const decl of match[2].matchAll(/(--[\w-]+):\s*([^;]+)/g)) out[decl[1]] = decl[2].trim();
  }
  return out;
}

const light = declarations('[data-theme=light]');
const dark = declarations('[data-theme=dark]');
const aliases = declarations('[data-theme]');

function resolve(scope, value, depth = 0) {
  if (depth > 8 || typeof value !== 'string') return value;
  return value.replace(/var\((--[\w-]+)\)/g, (whole, name) =>
    name in scope ? resolve(scope, scope[name], depth + 1) : whole,
  );
}

let failures = 0;
const note = (ok, label) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

console.log('\n  palette aliases');
note(Object.keys(aliases).length > 0, `[data-theme] re-declares ${Object.keys(aliases).length} aliases`);
note(Object.keys(light).length > 0 && Object.keys(dark).length > 0, 'both palettes are defined');

console.log('\n  a light card on a dark page');
// The page sets dark on <html>; the card sets light on itself. Inside the card
// the light palette wins, and the aliases resolve against it.
const cardScope = { ...dark, ...light, ...aliases };
const pageScope = { ...light, ...dark, ...aliases };

for (const [token, expected, label] of [
  ['--color-surface', light['--c-surface'], 'card background'],
  ['--color-fg', light['--c-fg'], 'card text'],
  ['--color-rule', light['--c-rule'], 'card rules'],
]) {
  const actual = resolve(cardScope, cardScope[token]);
  note(actual === expected, `${label}: ${actual} (expected ${expected})`);
}

console.log('\n  the page keeps its own');
const pageSurface = resolve(pageScope, pageScope['--color-surface']);
note(pageSurface === dark['--c-surface'], `page background: ${pageSurface}`);

if (failures) {
  console.error(`\n  ${failures} problem(s): the card cannot hold its own theme.`);
  process.exit(1);
}
console.log('\n  card themes resolve independently');
