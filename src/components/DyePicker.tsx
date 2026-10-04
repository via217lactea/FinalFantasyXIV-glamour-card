import { useEffect, useMemo, useState } from 'react';
import { displayName, loadStains, type Lang, type Stain } from '../lib/catalog.ts';
import { t } from '../lib/i18n.ts';

/** Stain.Shade groups the palette the same way the in-game dye window does. */
const SHADE_LABEL: Record<number, Record<Lang, string>> = {
  2: { ko: '무채색', ja: 'モノトーン', en: 'Neutral' },
  4: { ko: '붉은 계열', ja: 'レッド系', en: 'Reds' },
  5: { ko: '갈색 계열', ja: 'ブラウン系', en: 'Browns' },
  6: { ko: '노란 계열', ja: 'イエロー系', en: 'Yellows' },
  7: { ko: '녹색 계열', ja: 'グリーン系', en: 'Greens' },
  8: { ko: '파란 계열', ja: 'ブルー系', en: 'Blues' },
  9: { ko: '보라 계열', ja: 'パープル系', en: 'Purples' },
  10: { ko: '특수 염료', ja: '特殊染料', en: 'Special' },
};

interface Props {
  lang: Lang;
  current: Stain | null;
  label: string;
  onPick(stain: Stain | null): void;
  onClose(): void;
}

export function DyePicker({ lang, current, label, onPick, onClose }: Props) {
  const [stains, setStains] = useState<Stain[]>([]);
  const [hovered, setHovered] = useState<Stain | null>(current);

  useEffect(() => {
    loadStains().then(setStains).catch(() => setStains([]));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<number, Stain[]>();
    for (const stain of stains) {
      const list = map.get(stain.shade) ?? [];
      list.push(stain);
      map.set(stain.shade, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [stains]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--c-scrim)] p-4 pt-[8vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-label={label}
        className="flex max-h-[76vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-rule-strong bg-surface-raised shadow-2xl"
      >
        <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
          <p className="font-display text-xs tracking-[0.2em] text-fg-faint uppercase">
            {label}
          </p>
          <p className="truncate pl-3 text-sm text-fg">
            {hovered ? (
              <>
                {displayName(hovered.name, lang)}
                <span className="ml-2 font-mono text-[11px] text-fg-faint">
                  {hovered.hex}
                </span>
              </>
            ) : (
              <span className="text-fg-faint">{t(lang, 'noDye')}</span>
            )}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" onMouseLeave={() => setHovered(current)}>
          <button
            onClick={() => onPick(null)}
            className={`mb-4 w-full rounded border px-3 py-1.5 text-left text-sm ${
              current ? 'border-rule text-fg-dim' : 'border-[var(--accent)] text-fg'
            }`}
          >
            {t(lang, 'noDye')}
          </button>

          {groups.map(([shade, list]) => (
            <div key={shade} className="mb-4">
              <p className="mb-1.5 text-[11px] tracking-wider text-fg-faint">
                {SHADE_LABEL[shade]?.[lang] ?? `${shade}`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((stain) => (
                  <button
                    key={stain.id}
                    title={displayName(stain.name, lang)}
                    aria-label={displayName(stain.name, lang)}
                    onMouseEnter={() => setHovered(stain)}
                    onFocus={() => setHovered(stain)}
                    onClick={() => onPick(stain)}
                    style={{ background: stain.hex }}
                    className={`h-7 w-7 rounded-[3px] border transition-transform hover:scale-110 ${
                      current?.id === stain.id
                        ? 'border-fg ring-1 ring-fg'
                        : 'border-[var(--c-swatch-edge)]'
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
