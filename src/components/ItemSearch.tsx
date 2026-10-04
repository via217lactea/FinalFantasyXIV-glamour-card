import { useEffect, useRef, useState } from 'react';
import type { Slot } from '../../scripts/slots.ts';
import { displayName, searchSlot, type Item, type Lang } from '../lib/catalog.ts';
import { t } from '../lib/i18n.ts';
import { ItemIcon } from './ItemIcon.tsx';

interface Props {
  slot: Slot;
  slotLabel: string;
  lang: Lang;
  onPick(item: Item): void;
  onClose(): void;
}

export function ItemSearch({ slot, slotLabel, lang, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // The catalog is filtered to this slot already, so no debounce is needed for
    // the first page — the shard is at most 190 KB and searching it is instant.
    searchSlot(slot, query, lang)
      .then((items) => {
        if (cancelled) return;
        setResults(items);
        setCursor(0);
        setError(null);
      })
      .catch(() => !cancelled && setError(t(lang, 'loadFailed')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slot, query, lang]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') return onClose();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === 'Enter' && results[cursor]) {
      event.preventDefault();
      onPick(results[cursor]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--c-scrim)] p-4 pt-[8vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label={slotLabel}
        className="flex max-h-[76vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-rule-strong bg-surface-raised shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="border-b border-rule px-4 pt-3 pb-2">
          <p className="font-display text-xs tracking-[0.2em] text-fg-faint uppercase">
            {slotLabel}
          </p>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, 'searchPlaceholder')}
            className="mt-1 w-full bg-transparent text-lg text-fg outline-none placeholder:text-fg-faint"
          />
        </div>

        {error ? (
          <div className="p-6 text-center text-sm text-fg-dim">
            <p>{error}</p>
            <button
              onClick={() => setQuery((q) => q + '')}
              className="mt-3 rounded border border-rule-strong px-3 py-1 text-fg hover:border-[var(--accent)]"
            >
              {t(lang, 'retry')}
            </button>
          </div>
        ) : results.length === 0 && !loading ? (
          <p className="p-6 text-center text-sm text-fg-dim">{t(lang, 'noResults')}</p>
        ) : (
          <ul ref={listRef} className="flex-1 overflow-y-auto py-1">
            {results.map((item, index) => (
              <li key={item.id}>
                <button
                  data-index={index}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => onPick(item)}
                  className={`flex w-full items-center gap-3 px-4 py-1.5 text-left ${
                    index === cursor ? 'bg-rule/60' : ''
                  }`}
                >
                  <ItemIcon iconId={item.icon} size="34px" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      {displayName(item.name, lang)}
                    </span>
                    {item.name.ko && lang !== 'ko' && (
                      <span className="block truncate text-xs text-fg-faint">
                        {item.name.ko}
                      </span>
                    )}
                  </span>
                  {item.dyeCount > 0 && (
                    <span className="font-mono text-[11px] text-fg-faint">
                      {'◆'.repeat(item.dyeCount)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
