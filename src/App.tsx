import { useEffect, useRef } from 'react';
import { useAccent } from './lib/accent.ts';
import { initialTheme, useTheme } from './lib/theme.ts';
import { useVersions, versionFor } from './lib/versions.ts';
import { LANGUAGES, t } from './lib/i18n.ts';
import { dyeStrip, useCard } from './store/card.ts';
import { SlotRail } from './components/SlotRail.tsx';
import { CardPreview } from './components/CardPreview.tsx';
import { CardStage } from './components/CardStage.tsx';
import { MetaPanel } from './components/MetaPanel.tsx';
import { ExportBar } from './components/ExportBar.tsx';
import { ShareBar, useSharedCardFromUrl } from './components/ShareBar.tsx';

export function App() {
  const uiLang = useCard((s) => s.uiLang);
  const setUiLang = useCard((s) => s.setUiLang);
  const slots = useCard((s) => s.slots);
  const theme = useCard((s) => s.theme);
  const setTheme = useCard((s) => s.setTheme);
  const cardRef = useRef<HTMLDivElement>(null);
  const versions = useVersions();
  const shared = useSharedCardFromUrl();
  const patch = versionFor(versions, uiLang);

  // Respect the system preference on first visit, remember the choice after.
  useEffect(() => setTheme(initialTheme()), [setTheme]);
  useTheme(theme);
  useAccent(dyeStrip(slots));

  return (
    <div className="paper relative min-h-screen bg-surface-sunken">
      <header className="flex items-baseline justify-between border-b border-rule px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-lg text-fg">{t(uiLang, 'appName')}</h1>
          <p className="hidden text-xs text-fg-faint sm:block">{t(uiLang, 'tagline')}</p>
          {patch && (
            <span
              title={t(uiLang, uiLang === 'ko' ? 'patchKo' : 'patchGlobal')}
              className="rounded-full border border-rule px-2 py-px font-mono text-[10px] text-fg-faint"
            >
              {t(uiLang, 'patch')} {patch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={t(uiLang, theme === 'dark' ? 'themeToLight' : 'themeToDark')}
          title={t(uiLang, theme === 'dark' ? 'themeToLight' : 'themeToDark')}
          className="rounded border border-rule px-2 py-0.5 text-xs text-fg-dim hover:border-rule-strong hover:text-fg"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
        <nav className="flex gap-1" aria-label={t(uiLang, 'uiLanguage')}>
          {LANGUAGES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setUiLang(id)}
              className={`rounded px-2 py-0.5 text-xs ${
                uiLang === id ? 'text-fg' : 'text-fg-faint hover:text-fg-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        </div>
      </header>

      {shared === 'loading' && (
        <p className="px-5 pt-3 text-xs text-fg-dim">{t(uiLang, 'shareLoading')}</p>
      )}
      {shared === 'failed' && (
        <p className="px-5 pt-3 text-xs text-fg-dim">{t(uiLang, 'shareFailed')}</p>
      )}

      <main className="mx-auto grid max-w-[1600px] gap-6 p-5 lg:grid-cols-[300px_minmax(0,1fr)_260px]">
        <section aria-label={t(uiLang, 'equipment')}>
          <Heading>{t(uiLang, 'equipment')}</Heading>
          <SlotRail lang={uiLang} />
        </section>

        <section aria-label={t(uiLang, 'appName')}>
          <div className="lg:sticky lg:top-5">
            <CardStage>
              <CardPreview ref={cardRef} uiLang={uiLang} />
            </CardStage>
          </div>
        </section>

        <section aria-label={t(uiLang, 'details')}>
          <Heading>{t(uiLang, 'details')}</Heading>
          <MetaPanel lang={uiLang} />
          <div className="mt-5 border-t border-rule pt-4">
            <ExportBar lang={uiLang} cardRef={cardRef} />
          </div>
          <div className="mt-4 border-t border-rule pt-4">
            <ShareBar lang={uiLang} />
          </div>
        </section>
      </main>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-display text-xs tracking-[0.2em] text-fg-faint uppercase">
      {children}
    </h2>
  );
}
