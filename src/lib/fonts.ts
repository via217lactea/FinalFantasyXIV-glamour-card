/**
 * Every typeface the app loads, and where it came from.
 *
 * Two constraints govern what can go on this list:
 *
 *  1. The licence must permit commercial use, redistribution and embedding.
 *     SIL OFL 1.1 covers all three. A licence that allows a webfont link but
 *     forbids the file being embedded is unusable here, because the PNG export
 *     inlines the font data into the SVG it rasterises.
 *
 *  2. Korean faces are enormous — a full hangul set runs to thousands of
 *     glyphs, several MB unsubsetted. Anything carrying Korean must be served
 *     as a dynamic subset or split into unicode-range chunks, or the first
 *     paint stalls.
 *
 * Anthropic's Google Fonts and jsDelivr URLs are stable; if a face is ever
 * self-hosted, drop the file in public/fonts and change `href` to a local path.
 */

export interface FontEntry {
  /** The family name as it appears in CSS. */
  family: string;
  /** Which design token it backs. */
  role: 'sans' | 'display' | 'masthead' | 'title' | 'mono';
  licence: string;
  source: string;
  /** Scripts the face actually covers. */
  scripts: ('latin' | 'hangul' | 'kana')[];
  /** Stylesheet URL, or null for a system stack. */
  href: string | null;
}

export const FONTS: FontEntry[] = [
  {
    family: 'Pretendard Variable',
    role: 'sans',
    licence: 'SIL OFL 1.1',
    source: 'https://github.com/orioncactus/pretendard',
    scripts: ['latin', 'hangul', 'kana'],
    // One family covering all three scripts is why this is the body face. The
    // gear rows put Korean, Latin and kana on a single line — a sub-name reads
    // "Neo Queen's Tiara / ネオクイーン・ティアラ" — and a script-split family
    // would show kana riding above the hangul on every row.
    // The dynamic-subset build ships only the glyphs a page actually uses.
    href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
  },
  {
    family: 'Gowun Batang',
    role: 'display',
    licence: 'SIL OFL 1.1',
    source: 'https://fonts.google.com/specimen/Gowun+Batang',
    scripts: ['latin', 'hangul'],
    href: 'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap',
  },
  {
    family: 'Bodoni Moda',
    role: 'masthead',
    licence: 'SIL OFL 1.1',
    source: 'https://fonts.google.com/specimen/Bodoni+Moda',
    // Latin only. A hangul title set in this falls back to Gowun Batang, which
    // is why --font-masthead lists it second rather than relying on a generic.
    scripts: ['latin'],
    href: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700&display=swap',
  },
  {
    family: 'IBM Plex Sans',
    role: 'title',
    licence: 'SIL OFL 1.1',
    source: 'https://github.com/IBM/plex',
    // Plex splits by script: the Latin face carries no hangul or kana, so
    // 'IBM Plex Sans KR' and 'IBM Plex Sans JP' are stacked behind it. The KR
    // and JP faces sit on different baselines (22% vs 12%) and Sandoll has said
    // that is deliberate — which rules Plex out for body text, where scripts
    // share a line, but not for a title or a name, which is one language at a
    // time.
    scripts: ['latin'],
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap',
  },
  {
    family: 'IBM Plex Sans KR',
    role: 'title',
    licence: 'SIL OFL 1.1',
    source: 'https://fonts.google.com/specimen/IBM+Plex+Sans+KR',
    scripts: ['hangul', 'latin'],
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap',
  },
  {
    family: 'IBM Plex Sans JP',
    role: 'title',
    licence: 'SIL OFL 1.1',
    source: 'https://fonts.google.com/specimen/IBM+Plex+Sans+JP',
    scripts: ['kana'],
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600&display=swap',
  },
];

/**
 * Faces whose glyphs must be embedded in the exported PNG. A face used only in
 * the editor chrome does not need to be, but everything a template can render
 * does — a missing embed produces tofu boxes in the saved image, not a
 * fallback.
 */
export const EXPORT_FONTS = FONTS.filter((f) => f.role !== 'mono');
