import { t } from '../../lib/i18n.ts';
import { Barcode, CornerRules, EDITORIAL_INSET, TrimMarks } from '../../components/EditorialChrome.tsx';
import type { Template, TemplateProps } from '../types.ts';
import { EM, GearLine, ImageSlot } from './shared.tsx';

function Editorial(p: TemplateProps) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-raised">
      <TrimMarks />
      <CornerRules />
      {/* A rule box just inside the trim, and a vertical rule splitting the
          picture from the copy — the furniture of a proof sheet. */}
      <div
        style={{ inset: EDITORIAL_INSET - 20 }}
        className="pointer-events-none absolute border-x border-rule/70"
      />
      <div style={{ inset: EDITORIAL_INSET }} className="absolute flex gap-[38px]">
        <ImageSlot p={p} className="border border-rule" />

        <div className="flex min-w-0 flex-1 flex-col border-l border-rule/70 pl-6">
          {/* The outfit is what the card is about, so its name leads. The
              model, then the world and job, step down from there. */}
          <p className="font-display text-[10px] tracking-[0.34em] text-fg-faint uppercase">
            {t(p.cardLang, 'collection')}
          </p>
          <p
            style={{ fontFamily: 'var(--font-title)' }}
            className="mt-1 truncate text-[26px] leading-none font-medium tracking-tight text-fg"
          >
            {p.meta.title || t(p.uiLang, 'untitled')}
          </p>
          <div className="mt-1.5 h-px w-16 bg-fg/40" />

          {p.meta.characterName && (
            <p className="mt-2 flex items-baseline gap-2 truncate">
              <span className="shrink-0 font-display text-[9px] tracking-[0.28em] text-fg-faint uppercase">
                {t(p.cardLang, 'model')}
              </span>
              <span
                style={{ fontFamily: 'var(--font-title)' }}
                className="min-w-0 truncate text-[15px] text-fg"
              >
                {p.meta.characterName}
              </span>
            </p>
          )}
          {(p.meta.world || p.meta.job) && (
            <p className="mt-0.5 truncate font-display text-[12px] text-fg-dim">
              {[p.meta.world, p.meta.job].filter(Boolean).join('  ·  ')}
            </p>
          )}

          <div className="my-3 h-px w-full bg-rule" />

          <div ref={p.fit.boxRef} className="min-h-0 flex-1 overflow-hidden">
            {p.worn.length === 0 ? (
              <p className="text-[13px] text-fg-faint">{t(p.uiLang, 'emptyCard')}</p>
            ) : (
              <ul ref={p.fit.contentRef} style={{ fontSize: `${p.fit.scale * 16}px` }}>
                {p.worn.map((piece) => (
                  // Lookbook convention: other-language name above, primary name
                  // largest, dyes as text. No icon — the photograph is the only
                  // image on the page.
                  <li key={piece.slot} className="mb-[0.55em]">
                    <GearLine
                      piece={piece}
                      lang={p.cardLang}
                      showSub={p.showSubNames}
                      density={p.density}
                      dyeStyle={p.dyeStyle}
                      nameClass="font-display"
                      nameEm={EM.name * 1.18}
                      subClass="font-display text-fg-dim"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="font-display text-[13px] tracking-[0.14em] text-fg uppercase">
                Final Fantasy XIV
              </p>
              <p className="mt-1 text-[8.5px] leading-relaxed tracking-wide text-fg-faint">
                FINAL FANTASY XIV © SQUARE ENIX CO., LTD. All Rights Reserved.
              </p>
            </div>
            <div className="text-right">
              <Barcode label={`${p.meta.title}${p.meta.characterName}${p.worn.length}`} />
              <p className="mt-0.5 font-mono text-[8px] tracking-[0.18em] text-fg-faint">
                {p.patch ? `PATCH ${p.patch}` : 'GLAMOUR'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Spine text, the way a lookbook prints its title down the edge. */}
      <p
        style={{ writingMode: 'vertical-rl' }}
        className="absolute top-1/2 right-[18px] -translate-y-1/2 font-display text-[10px] tracking-[0.42em] text-fg-faint uppercase"
      >
        {t(p.cardLang, 'collection')}
      </p>
    </div>
  );
}

export const editorialTemplate: Template = {
  id: 'editorial',
  name: { ko: '룩북', ja: 'ルックブック', en: 'Lookbook' },
  author: 'built-in',
  languages: ['ko', 'ja', 'en'],
  Component: Editorial,
};
