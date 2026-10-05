import { t } from '../../lib/i18n.ts';
import { Barcode, DyeBar } from '../../components/EditorialChrome.tsx';
import type { Template, TemplateProps } from '../types.ts';
import { GearLine, ImageSlot } from './shared.tsx';

/** Small caps sitting at either end of a hairline, as a masthead does. */
function RuleLine({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-fg pb-1 text-[8px] tracking-[0.2em] whitespace-nowrap text-fg uppercase">
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  );
}

function Masthead(p: TemplateProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-surface-raised">
      <ImageSlot p={p} className="bg-surface-sunken" />

      <div className="relative flex min-w-0 flex-1 flex-col px-8 pt-5 pb-5">
        <RuleLine left="First Look" right="For Final Fantasy XIV" />

        {/* The masthead: an oversized Didone with a ghosted italic behind it. */}
        <div className="relative mt-3">
          <span
            style={{ fontFamily: 'var(--font-masthead)' }}
            className="pointer-events-none absolute -top-3 left-1 text-[38px] leading-none text-fg/10 italic"
          >
            Eorzea
          </span>
          <p
            style={{ fontFamily: 'var(--font-masthead)', letterSpacing: '-0.01em' }}
            className="relative text-center text-[52px] leading-[0.8] font-medium whitespace-nowrap text-fg"
          >
            EORZEA
          </p>
        </div>
        <div className="mt-2 border-t border-fg" />
        <p className="mt-1 text-center text-[9px] tracking-[0.5em] whitespace-nowrap text-fg uppercase">
          Fashion Collection
        </p>

        <p
          style={{ fontFamily: 'var(--font-title)' }}
          className="mt-3 truncate text-right text-[20px] font-medium text-fg"
        >
          {p.meta.title || t(p.uiLang, 'untitled')}
        </p>
        <div className="mt-1 border-b border-fg/70" />

        <div className="mt-3">
          <RuleLine left="New Outfit" right="First Look //" />
        </div>

        <div className="mt-3 flex items-start gap-5">
          {/* Boxed letters, borrowed from a garment size tag. */}
          <div className="flex shrink-0 flex-col gap-1">
            {['S', 'M', 'L'].map((size) => (
              <span
                key={size}
                className="flex h-[17px] w-[17px] items-center justify-center border border-fg/80 text-[9px] leading-none text-fg"
              >
                {size}
              </span>
            ))}
          </div>

          {/* The weight bar, arrow and barcode stack down the right half, the
              way a print proof lays out its density strip and marks. */}
          <div className="flex min-w-0 flex-1 flex-col items-end gap-1">
            <DyeBar colors={p.dyeColors} className="h-[11px] w-full" />
            <span className="text-[13px] leading-none text-fg">↘</span>
            <Barcode
              label={`${p.meta.title}${p.meta.characterName}`}
              width={148}
              height={26}
            />
          </div>
        </div>

        <div className="mt-3">
          <RuleLine left="List." />
        </div>

        <div ref={p.fit.boxRef} className="mt-2 min-h-0 flex-1 overflow-hidden">
          {p.worn.length === 0 ? (
            <p className="text-[11px] text-fg-faint">{t(p.uiLang, 'emptyCard')}</p>
          ) : (
            <ul ref={p.fit.contentRef} style={{ fontSize: `${p.fit.scale * 16}px` }}>
              {p.worn.map((piece) => (
                <li key={piece.slot} className="mb-[0.45em]">
                  <GearLine
                    piece={piece}
                    lang={p.cardLang}
                    showSub={p.showSubNames}
                    density={p.density}
                    dyeStyle={p.dyeStyle}
                    nameClass="font-display"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-2 flex items-end justify-between text-[8px] text-fg-faint">
          <div className="min-w-0">
            <p className="text-[11px] leading-none text-fg">✳</p>
            <p
              style={{ fontFamily: 'var(--font-title)' }}
              className="mt-1.5 truncate text-[11px]"
            >
              {[p.meta.characterName, p.meta.world, p.meta.job].filter(Boolean).join('  ·  ')}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tracking-wide">
              FINAL FANTASY XIV © SQUARE ENIX CO., LTD.
            </p>
            <p className="tracking-wide">All Rights Reserved.</p>
            {p.patch && <p className="mt-0.5 font-mono tracking-[0.18em]">PATCH {p.patch}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export const mastheadTemplate: Template = {
  id: 'masthead',
  name: { ko: '매거진 표제', ja: 'マガジン', en: 'Masthead' },
  author: 'built-in',
  languages: ['ko', 'ja', 'en'],
  Component: Masthead,
};
