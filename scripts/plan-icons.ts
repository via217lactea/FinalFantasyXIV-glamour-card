import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Prints the SaintCoinach commands that cover exactly the icons this catalog
 * uses.
 *
 *   npm run icons:plan
 *
 * `ui` accepts a range, and the catalog's icons sit in a handful of clusters
 * rather than spread evenly, so a few ranged commands fetch what a bare `ui`
 * would take twenty times as long to produce.
 *
 * Ranges are recomputed from the data rather than hardcoded: a patch adds items
 * at the top of the range, and a stale number here would silently leave the
 * newest gear without icons.
 */

/** Below this, two clusters are cheaper to fetch as one range than separately. */
const BRIDGE_GAP = 2000;

async function main() {
  const dir = join(process.cwd(), 'public', 'data', 'items');
  const icons = new Set<number>();
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.json')) continue;
    const { items } = JSON.parse(await readFile(join(dir, file), 'utf8')) as {
      items: [number, number, ...unknown[]][];
    };
    for (const [, icon] of items) if (icon > 0) icons.add(icon);
  }

  const sorted = [...icons].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const id of sorted.slice(1)) {
    if (id - previous > BRIDGE_GAP) {
      ranges.push([start, previous]);
      start = id;
    }
    previous = id;
  }
  ranges.push([start, previous]);

  const span = ranges.reduce((sum, [a, b]) => sum + (b - a + 1), 0);

  console.log(`\n  이 카탈로그는 아이콘 ${icons.size}개를 쓴다.`);
  console.log('  SaintCoinach.Cmd.exe 를 실행하고 아래를 한 줄씩 입력한다.\n');
  for (const [a, b] of ranges) {
    console.log(`      ui ${a} ${b}`);
  }
  console.log(`\n  훑는 번호는 ${span.toLocaleString()}개.`);
  console.log('  그냥 ui 만 입력하면 100만 번대까지 전부 뽑느라 훨씬 오래 걸린다.\n');
  console.log('  끝나면 날짜 폴더가 생긴다. 그 안의 ui/icon 을 가리켜:\n');
  console.log('      npm run build:icons -- --from "<날짜폴더>/ui/icon"\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
