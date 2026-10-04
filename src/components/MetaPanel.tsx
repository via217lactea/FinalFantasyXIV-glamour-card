import { useState } from 'react';
import type { Lang } from '../lib/catalog.ts';
import { LANGUAGES, LAYOUT_KEYS, t } from '../lib/i18n.ts';
import { findTemplate } from '../card/registry.ts';
import { TemplatePicker } from './TemplatePicker.tsx';
import { resolveCardLang, useCard } from '../store/card.ts';
import { ImageDrop } from './ImageDrop.tsx';

export function MetaPanel({ lang }: { lang: Lang }) {
  const meta = useCard((s) => s.meta);
  const setMeta = useCard((s) => s.setMeta);
  const cardLang = useCard((s) => s.cardLang);
  const resolvedCardLang = resolveCardLang(cardLang, lang);
  const setCardLang = useCard((s) => s.setCardLang);
  const reset = useCard((s) => s.reset);
  const layout = useCard((s) => s.layout);
  const setLayout = useCard((s) => s.setLayout);
  const templateId = useCard((s) => s.templateId);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const template = findTemplate(templateId);
  const untested = !template.languages.includes(resolvedCardLang);

  const dyeStyle = useCard((s) => s.dyeStyle);
  const setDyeStyle = useCard((s) => s.setDyeStyle);
  const cardTheme = useCard((s) => s.cardTheme);
  const setCardTheme = useCard((s) => s.setCardTheme);
  const showSubNames = useCard((s) => s.showSubNames);
  const setShowSubNames = useCard((s) => s.setShowSubNames);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[11px] tracking-wider text-fg-faint">{t(lang, 'image')}</p>
        <ImageDrop lang={lang} />
      </div>

      <div>
        <p className="mb-1 text-[11px] tracking-wider text-fg-faint">{t(lang, 'layout')}</p>
        <div className="flex gap-1">
          {LAYOUT_KEYS.map((id) => (
            <button
              key={id}
              onClick={() => setLayout(id)}
              className={`flex-1 rounded border px-2 py-1 text-xs ${
                layout === id
                  ? 'border-[var(--accent)] text-fg'
                  : 'border-rule text-fg-dim hover:border-rule-strong'
              }`}
            >
              {t(lang, id === 'square' ? 'layoutSquare' : id === 'wide' ? 'layoutWide' : 'layoutLandscape')}
            </button>
          ))}
        </div>
      </div>

      <Field
        label={t(lang, 'cardTitle')}
        value={meta.title}
        onChange={(title) => setMeta({ title })}
      />
      <Field
        label={t(lang, 'characterName')}
        value={meta.characterName}
        onChange={(characterName) => setMeta({ characterName })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t(lang, 'world')} value={meta.world} onChange={(world) => setMeta({ world })} />
        <Field label={t(lang, 'job')} value={meta.job} onChange={(job) => setMeta({ job })} />
      </div>

      <div>
        <p className="mb-1 text-[11px] tracking-wider text-fg-faint">{t(lang, 'template')}</p>
        <TemplatePicker lang={lang} />
        {untested && (
          <p className="mt-1 text-[10px] text-fg-faint">{t(lang, 'templateUntested')}</p>
        )}
      </div>

      <div>
        <p className="mb-1 text-[11px] tracking-wider text-fg-faint">{t(lang, 'dyeStyle')}</p>
        <div className="flex gap-1">
          {(['swatch', 'text'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setDyeStyle(id)}
              className={`flex-1 rounded border px-2 py-1 text-xs ${
                dyeStyle === id
                  ? 'border-[var(--accent)] text-fg'
                  : 'border-rule text-fg-dim hover:border-rule-strong'
              }`}
            >
              {t(lang, id === 'swatch' ? 'dyeSwatch' : 'dyeText')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] tracking-wider text-fg-faint">{t(lang, 'cardTheme')}</p>
        <div className="flex gap-1">
          {(['auto', 'light', 'dark'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setCardTheme(id)}
              className={`flex-1 rounded border px-2 py-1 text-xs ${
                cardTheme === id
                  ? 'border-[var(--accent)] text-fg'
                  : 'border-rule text-fg-dim hover:border-rule-strong'
              }`}
            >
              {t(lang, id === 'auto' ? 'themeAuto' : id === 'light' ? 'themeLight' : 'themeDark')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] tracking-wider text-fg-faint">
          {t(lang, 'cardLanguage')}
        </p>
        <div className="flex gap-1">
          {[{ id: 'auto' as const, label: t(lang, 'langAuto') }, ...LANGUAGES].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCardLang(id)}
              className={`flex-1 rounded border px-2 py-1 text-xs ${
                cardLang === id
                  ? 'border-[var(--accent)] text-fg'
                  : 'border-rule text-fg-dim hover:border-rule-strong'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-fg-faint">
          {t(lang, 'cardLanguageHint')}
        </p>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-fg-dim">
          <input
            type="checkbox"
            checked={showSubNames}
            onChange={(e) => setShowSubNames(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          {t(lang, 'subNames')}
        </label>
      </div>

      {/* Confirmation happens in place rather than through window.confirm:
          blocking dialogs are suppressed in sandboxed frames, where the call
          returns undefined and the reset silently never runs. */}
      {confirmingReset ? (
        <div className="rounded border border-[var(--accent)] p-2">
          <p className="text-[11px] leading-relaxed text-fg-dim">{t(lang, 'resetConfirm')}</p>
          <div className="mt-2 flex gap-1">
            <button
              onClick={() => {
                reset();
                setConfirmingReset(false);
              }}
              className="flex-1 rounded border border-[var(--accent)] px-2 py-1 text-xs text-fg"
            >
              {t(lang, 'resetYes')}
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              className="flex-1 rounded border border-rule px-2 py-1 text-xs text-fg-dim hover:border-rule-strong"
            >
              {t(lang, 'cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingReset(true)}
          className="w-full rounded border border-rule px-3 py-1.5 text-xs text-fg-dim hover:border-[var(--accent)] hover:text-fg"
        >
          {t(lang, 'reset')}
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] tracking-wider text-fg-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-rule bg-surface-sunken px-2.5 py-1.5 text-sm text-fg outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
