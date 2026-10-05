import { displayName, type Lang, type Stain } from '../../lib/catalog.ts';
import { otherNames } from '../../lib/names.ts';
import { t } from '../../lib/i18n.ts';
import type { DyeStyle, TemplateProps, WornPiece } from '../types.ts';

/** Row type is sized in em against the list's scaled root. */
export const EM = { name: 0.8125, sub: 0.625, dye: 0.594 };

export function secondaryName(piece: WornPiece, lang: Lang, show: boolean): string {
  return show ? otherNames(piece.item.name, lang) : '';
}

export function dyeNames(piece: WornPiece, lang: Lang): string[] {
  return piece.dyes.filter((d): d is Stain => Boolean(d)).map((d) => displayName(d.name, lang));
}

/** A dye reads as "1 - 순백색", the way the game labels its two channels. */
export function DyeSwatches({ piece, lang }: { piece: WornPiece; lang: Lang }) {
  return (
    <p className="mt-[0.3em] flex flex-wrap gap-[0.3em]">
      {piece.dyes.map(
        (stain, i) =>
          stain && (
            // whitespace-nowrap is load-bearing: the PNG export measures text
            // slightly differently from the screen, and without it a label that
            // just fits on one line here breaks across two in the saved image.
            <span
              key={i}
              style={{ fontSize: `${EM.dye}em` }}
              className="inline-flex items-center gap-[0.4em] rounded-[0.25em] border border-rule px-[0.45em] py-[0.15em] leading-none whitespace-nowrap text-fg-dim"
            >
              <span
                style={{ background: stain.hex }}
                className="h-[1.05em] w-[1.05em] shrink-0 rounded-[0.15em] border border-[var(--c-swatch-edge)]"
              />
              {i + 1} - {displayName(stain.name, lang)}
            </span>
          ),
      )}
    </p>
  );
}

export function DyeText({ piece, lang }: { piece: WornPiece; lang: Lang }) {
  const names = dyeNames(piece, lang);
  if (!names.length) return null;
  return (
    <p
      style={{ fontSize: `${EM.dye}em` }}
      className="mt-[0.2em] truncate font-display whitespace-nowrap text-fg-dim"
    >
      {names.join('  |  ')}
    </p>
  );
}

export function Dyes({ piece, lang, style }: { piece: WornPiece; lang: Lang; style: DyeStyle }) {
  if (!piece.dyes.some(Boolean)) return null;
  return style === 'text' ? <DyeText piece={piece} lang={lang} /> : <DyeSwatches piece={piece} lang={lang} />;
}

/**
 * One row of a gear list, shared by every template.
 *
 * The row sheds lines as the outfit grows: first the dye names move up onto the
 * secondary line, then the secondary line itself moves up beside the name. A
 * fourteen-piece outfit simply cannot afford three lines each on a 16:9 card,
 * and folding is better than shrinking the type past readability.
 *
 * Everything is sized in em so the fitting pass can scale the whole list by
 * changing a single font size.
 */
export function GearLine({
  piece,
  lang,
  showSub,
  density,
  dyeStyle,
  nameClass = 'font-medium',
  nameEm = EM.name,
  subClass = 'text-fg-faint',
}: {
  piece: WornPiece;
  lang: Lang;
  showSub: boolean;
  density: 0 | 1 | 2;
  dyeStyle: DyeStyle;
  nameClass?: string;
  nameEm?: number;
  subClass?: string;
}) {
  const secondary = secondaryName(piece, lang, showSub);
  const colours = dyeNames(piece, lang);
  const foldDyes = density >= 1 && colours.length > 0;
  const sub = [secondary, foldDyes ? colours.join(' | ') : ''].filter(Boolean).join('  ·  ');
  const foldSub = density >= 2 && Boolean(sub);

  return (
    <>
      <p
        style={{ fontSize: `${nameEm}em` }}
        className={`flex items-baseline gap-[0.5em] truncate leading-snug text-fg ${nameClass}`}
      >
        <span className="shrink-0">{displayName(piece.item.name, lang)}</span>
        {foldSub && (
          <span
            style={{ fontSize: `${EM.sub / nameEm}em` }}
            className={`min-w-0 truncate font-normal ${subClass}`}
          >
            {sub}
          </span>
        )}
      </p>
      {!foldSub && sub && (
        <p style={{ fontSize: `${EM.sub}em` }} className={`truncate leading-snug ${subClass}`}>
          {sub}
        </p>
      )}
      {!foldDyes && <Dyes piece={piece} lang={lang} style={dyeStyle} />}
    </>
  );
}

/**
 * The screenshot's place on the card, held open whether or not one has been
 * added.
 *
 * An empty card that simply omits the image reads as a finished design with no
 * picture in it — nothing suggests a picture belongs there. Reserving the space
 * shows the layout the card will actually have, so the person can see where
 * their screenshot lands before uploading it. The placeholder is drawn with the
 * card's own tokens, so it is legible in either theme.
 */
export function ImageSlot({ p, className = '' }: { p: TemplateProps; className?: string }) {
  return (
    <div
      style={{ flex: `0 0 ${p.imageShare * 100}%` }}
      className={`relative overflow-hidden ${className}`}
    >
      {p.image ? (
        <img
          src={p.image}
          alt=""
          style={{
            objectPosition: `${p.imageFocus.x}% ${p.imageFocus.y}%`,
            // Zoom scales about the chosen focus point, so dragging and zooming
            // compose the way they do in a photo editor.
            transform: p.imageZoom === 1 ? undefined : `scale(${p.imageZoom})`,
            transformOrigin: `${p.imageFocus.x}% ${p.imageFocus.y}%`,
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-rule-strong/70 bg-surface-sunken/40">
          {/* A framed mountain: the long-standing shorthand for a picture. */}
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            className="stroke-fg-faint"
            strokeWidth="1.2"
            aria-hidden="true"
          >
            <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
            <circle cx="8.5" cy="9.5" r="1.4" />
            <path d="M3.5 16.5 L9 11.5 L13 15 L16 12.5 L20.5 17" strokeLinejoin="round" />
          </svg>
          <p className="px-3 text-center text-[11px] leading-snug text-fg-faint">
            {t(p.uiLang, 'imageSlotHint')}
          </p>
        </div>
      )}
    </div>
  );
}
