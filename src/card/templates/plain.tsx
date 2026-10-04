import { slotName, t } from '../../lib/i18n.ts';
import { ItemIcon } from '../../components/ItemIcon.tsx';
import type { Template, TemplateProps } from '../types.ts';
import { GearLine, ImageSlot } from './shared.tsx';

function Plain(p: TemplateProps) {
  const identity = [p.meta.characterName, p.meta.world].filter(Boolean).join(' @ ');

  return (
    <div className="paper flex h-full w-full overflow-hidden rounded-xl border border-rule-strong bg-surface">
      <ImageSlot p={p} className="bg-surface-sunken" />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="rule-double mx-7 pt-7 pb-4">
          <p className="font-display text-[11px] tracking-[0.28em] text-fg-faint uppercase italic">
            {t(p.cardLang, 'cardEyebrow')}
          </p>
          <h2
            style={{ fontFamily: 'var(--font-title)' }}
            className="mt-1 text-[32px] leading-tight font-medium break-keep text-fg"
          >
            {p.meta.title || <span className="text-fg-faint">{t(p.uiLang, 'untitled')}</span>}
          </h2>
          {(identity || p.meta.job) && (
            <p
              style={{ fontFamily: 'var(--font-title)' }}
              className="mt-1 truncate text-[14px] text-fg-dim"
            >
              {identity}
              {identity && p.meta.job && <span className="mx-2 text-fg-faint">·</span>}
              {p.meta.job}
            </p>
          )}
        </div>

        <div ref={p.fit.boxRef} className="min-h-0 flex-1 overflow-hidden px-7 pt-2">
          {p.worn.length === 0 ? (
            <p className="text-[13px] text-fg-faint">{t(p.uiLang, 'emptyCard')}</p>
          ) : (
            <ul ref={p.fit.contentRef} style={{ fontSize: `${p.fit.scale * 16}px` }}>
              {p.worn.map((piece) => (
                <li
                  key={piece.slot}
                  className="flex items-start gap-[0.6em] border-t border-rule/70 py-[0.4em]"
                >
                  <ItemIcon
                    iconId={piece.item.icon}
                    size="2.1em"
                    fallback={slotName(p.cardLang, piece.slot).slice(0, 1)}
                  />
                  <div className="min-w-0 flex-1">
                    <GearLine
                      piece={piece}
                      lang={p.cardLang}
                      showSub={p.showSubNames}
                      density={p.density}
                      dyeStyle={p.dyeStyle}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-rule px-7 py-3 text-[12px] text-fg-faint">
          <span>
            {p.worn.length} {t(p.cardLang, 'pieces')}
            {p.dyeCount > 0 && (
              <>
                <span className="mx-2">·</span>
                {p.dyeCount} {t(p.cardLang, 'colors')}
              </>
            )}
          </span>
          <span className="flex items-center gap-3">
            {p.patch && (
              <span className="font-mono">
                {t(p.cardLang, 'patch')} {p.patch}
              </span>
            )}
            <span className="font-display tracking-wider">
              FINAL FANTASY XIV © SQUARE ENIX
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export const plainTemplate: Template = {
  id: 'plain',
  name: { ko: '기본 카드', ja: 'シンプル', en: 'Plain card' },
  author: 'built-in',
  languages: ['ko', 'ja', 'en'],
  Component: Plain,
};
