import { toPng } from 'html-to-image';

/**
 * Turns the card node into a PNG.
 *
 * The exporter serialises the DOM into an SVG `foreignObject` and rasterises
 * that. Two consequences drive everything here:
 *
 *  - The SVG is rendered in isolation, so anything it references by URL is
 *    unreachable. Fonts have to be inlined as data URIs or the card comes out
 *    in tofu boxes rather than falling back to a system face.
 *  - Any image drawn from a different origin taints the canvas and the export
 *    throws. Icons are served same-origin and screenshots are read as data
 *    URIs, which is what keeps this working.
 */

/** Two gives a 1920px-wide card, which is enough for any social timeline. */
export const DEFAULT_PIXEL_RATIO = 2;

/**
 * True while a card is being serialised. The editor shrinks the card to fit its
 * column with a transform, and the exporter removes that transform for the
 * duration; anything watching the card for resizes has to sit still, or it will
 * rescale the very node being captured.
 */
let exporting = false;
export const isExporting = () => exporting;

export interface ExportOptions {
  pixelRatio?: number;
  /** Filename stem; the extension is added here. */
  name?: string;
}

let fontCssPromise: Promise<string> | null = null;

/**
 * Collects every @font-face the page loaded and rewrites its src as a data URI.
 *
 * html-to-image can do this itself, but it walks `document.styleSheets`, and a
 * stylesheet served from another origin exposes no `cssRules` — reading them
 * throws a SecurityError which the library swallows, silently dropping the
 * font. Both of our font sources are cross-origin, so we fetch the CSS text
 * ourselves, where no such restriction applies.
 */
async function embeddedFontCss(): Promise<string> {
  fontCssPromise ??= (async () => {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
      .map((link) => link.href)
      .filter((href) => /fonts\.googleapis\.com|pretendard/.test(href));

    const sheets = await Promise.all(
      links.map((href) =>
        fetch(href)
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => ''),
      ),
    );

    const css = sheets.join('\n');
    const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+?)\)/g)].map((m) => m[1]))];

    // A full Korean family is megabytes; the dynamic subsets the page already
    // requested are far smaller, but there are still dozens of them, so fetch
    // in parallel and skip any that fail rather than failing the export.
    const entries = await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const buffer = await res.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          }
          const mime = url.endsWith('.woff2')
            ? 'font/woff2'
            : url.endsWith('.woff')
              ? 'font/woff'
              : 'font/truetype';
          return [url, `data:${mime};base64,${btoa(binary)}`] as const;
        } catch {
          return null;
        }
      }),
    );

    let inlined = css;
    for (const entry of entries) {
      if (!entry) continue;
      inlined = inlined.split(entry[0]).join(entry[1]);
    }
    // Anything that could not be inlined would be fetched at raster time and
    // fail, so drop those rules entirely and let the fallback stack apply.
    return inlined
      .split('@font-face')
      .filter((block, i) => i === 0 || !/url\(https:/.test(block))
      .join('@font-face');
  })();

  return fontCssPromise;
}

/**
 * Safari paints the first `foreignObject` raster before its resources have
 * settled, producing a blank or half-drawn image. Rendering twice and keeping
 * the second result is the standard workaround; the first pass also warms the
 * font cache, so it is worth doing everywhere rather than sniffing the browser.
 */
export async function renderCardToPng(
  node: HTMLElement,
  { pixelRatio = DEFAULT_PIXEL_RATIO }: ExportOptions = {},
): Promise<string> {
  const fontEmbedCSS = await embeddedFontCss();

  // The editor shrinks the card to fit its column with a transform on the
  // parent. Serialising while that is applied bakes the shrink into the export,
  // so it comes off for the duration and goes back afterwards.
  const stage = node.parentElement;
  const stageTransform = stage?.style.transform ?? '';
  exporting = true;
  if (stage && stageTransform) stage.style.transform = 'none';
  const options = {
    pixelRatio,
    cacheBust: false,
    fontEmbedCSS,
    // The card paints its own background; leaving this undefined would export
    // the rounded corners as transparent, which reads as ragged on a timeline.
    backgroundColor: getComputedStyle(node).backgroundColor || undefined,
    width: node.offsetWidth,
    height: node.offsetHeight,
  };

  try {
    await toPng(node, options);
    return await toPng(node, options);
  } finally {
    if (stage && stageTransform) stage.style.transform = stageTransform;
    exporting = false;
  }
}

/** Turns a card title into something safe to write to disk. */
export function exportFilename(title: string, characterName: string): string {
  const stem =
    [title, characterName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' - ')
      .replace(/[\\/:*?"<>|]/g, '')
      .slice(0, 60) || 'glamour';
  const date = new Date().toISOString().slice(0, 10);
  return `${stem} ${date}.png`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
