import { t } from '../../lib/i18n.ts';
import type { Template, TemplateProps } from '../types.ts';
import { GearLine, ImageSlot } from './shared.tsx';

/**
 * A magazine spread: an oversized Didone set flush left, a boxed strip of
 * setting matter beneath it, then a grotesque subtitle over the garment list.
 *
 * The reference this follows carries two photographs. One is enough — the
 * layout's character comes from the masthead block and the ruled box, not from
 * the number of images — so the single screenshot takes the whole right side.
 */
function Spread(p: TemplateProps) {
  const setting = [p.meta.characterName, p.meta.world, p.meta.job].filter(Boolean);

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface-raised px-11 pt-7 pb-7">
      <div className="flex min-w-0 flex-1 flex-col pr-9">
        <div className="border-b border-fg/70 pb-1" />

        <p
          style={{ fontFamily: 'var(--font-masthead)', letterSpacing: '-0.02em' }}
          className="mt-3 text-[54px] leading-[0.8] font-medium text-fg"
        >
          EORZEA
        </p>

        {/* Setting matter, ruled into columns the way a masthead block is. */}
        <div className="mt-2 flex border border-fg/70 text-[7.5px] leading-[1.5] text-fg-dim">
          <div className="shrink-0 border-r border-fg/70 px-2 py-1.5">
            <p className="font-semibold tracking-wide text-fg uppercase">Firstlook</p>
            <p className="mt-0.5 font-mono">{p.patch ? `PATCH ${p.patch}` : 'GLAMOUR'}</p>
          </div>
          <div className="min-w-0 flex-1 border-r border-fg/70 px-2 py-1.5">
            {p.meta.title && <p className="truncate text-fg">{p.meta.title}</p>}
            {setting.length > 0 && <p className="truncate">{setting.join('  ·  ')}</p>}
            <p>
              {p.worn.length} {t(p.cardLang, 'pieces')}
              {p.dyeCount > 0 && `  ·  ${p.dyeCount} ${t(p.cardLang, 'colors')}`}
            </p>
          </div>
          <div className="w-[74px] shrink-0 px-2 py-1.5">
            <p>FINAL FANTASY XIV</p>
            <p>© SQUARE ENIX CO., LTD.</p>
            <p>All Rights Reserved.</p>
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <p className="text-[19px] leading-none font-bold tracking-tight text-fg">
            EORZEA FASHION
          </p>
          {/* The ruled box above is set at 7.5px, too small to carry a name, so
              the signature gets its own line here. */}
          {/* Always present, like the title slot in every other template — an
              empty card should still show where the name will sit. */}
          <p
            style={{ fontFamily: 'var(--font-title)' }}
            className="min-w-0 truncate text-[16px] leading-none text-fg-dim"
          >
            {p.meta.title || p.meta.characterName || t(p.uiLang, 'untitled')}
          </p>
        </div>
        <div className="mt-2 border-b border-fg/70" />

        <div ref={p.fit.boxRef} className="mt-2 min-h-0 flex-1 overflow-hidden">
          {p.worn.length === 0 ? (
            <p className="text-[11px] text-fg-faint">{t(p.uiLang, 'emptyCard')}</p>
          ) : (
            <ul ref={p.fit.contentRef} style={{ fontSize: `${p.fit.scale * 16}px` }}>
              {p.worn.map((piece) => (
                <li key={piece.slot} className="mb-[0.5em]">
                  <GearLine
                    piece={piece}
                    lang={p.cardLang}
                    showSub={p.showSubNames}
                    density={p.density}
                    dyeStyle={p.dyeStyle}
                    nameClass="font-semibold"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>

      <ImageSlot p={p} className="bg-surface-sunken" />
    </div>
  );
}

export const spreadTemplate: Template = {
  id: 'spread',
  name: { ko: '패션 스프레드', ja: 'スプレッド', en: 'Spread' },
  author: 'built-in',
  languages: ['ko', 'ja', 'en'],
  Component: Spread,
};
