import { useState } from 'react';
import type { Lang } from '../lib/catalog.ts';
import { downloadDataUrl, exportFilename, renderCardToPng } from '../lib/export.ts';
import { t } from '../lib/i18n.ts';
import { CARD_WIDTH } from './CardPreview.tsx';
import { useCard } from '../store/card.ts';

const RATIOS = [1, 2, 3] as const;

export function ExportBar({
  lang,
  cardRef,
}: {
  lang: Lang;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const meta = useCard((s) => s.meta);
  const [ratio, setRatio] = useState<number>(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const node = cardRef.current;
    if (!node || busy) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await renderCardToPng(node, { pixelRatio: ratio });
      downloadDataUrl(dataUrl, exportFilename(meta.title, meta.characterName));
    } catch {
      // The usual cause is a tainted canvas — an image that came from another
      // origin. Saying so is more use than the browser's own message.
      setError(t(lang, 'exportFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1 text-[11px] tracking-wider text-fg-faint">{t(lang, 'resolution')}</p>
      <div className="flex gap-1">
        {RATIOS.map((r) => (
          <button
            key={r}
            onClick={() => setRatio(r)}
            className={`flex-1 rounded border px-2 py-1 text-xs ${
              ratio === r
                ? 'border-[var(--accent)] text-fg'
                : 'border-rule text-fg-dim hover:border-rule-strong'
            }`}
          >
            {CARD_WIDTH * r}px
          </button>
        ))}
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="mt-2 w-full rounded border border-[var(--accent)] px-3 py-2 text-sm text-fg disabled:opacity-60"
      >
        {busy ? t(lang, 'exportBusy') : t(lang, 'exportSave')}
      </button>

      {error && <p className="mt-1.5 text-[11px] leading-relaxed text-fg-dim">{error}</p>}
    </div>
  );
}
