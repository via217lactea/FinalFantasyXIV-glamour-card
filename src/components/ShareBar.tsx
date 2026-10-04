import { useEffect, useRef, useState } from 'react';
import { UI_SLOTS, type Slot } from '../../scripts/slots.ts';
import { TEMPLATES } from '../card/registry.ts';
import { loadSlot, loadStains, type Item, type Stain } from '../lib/catalog.ts';
import { t } from '../lib/i18n.ts';
import { decodeCard, encodeCard, readShareParam, shareUrl, type SharedCard } from '../lib/share.ts';
import { useCard, type UiSlotId } from '../store/card.ts';
import type { Lang } from '../lib/catalog.ts';

const templateIds = () => TEMPLATES.map((tpl) => tpl.id);

/**
 * Restores a card from the URL fragment on first load.
 *
 * A link carries ids, not items, so the catalogue shards for the slots in use
 * have to be fetched before anything can be shown. Only those shards are
 * touched — a three-piece outfit does not pull the whole catalogue.
 */
export function useSharedCardFromUrl(): 'idle' | 'loading' | 'done' | 'failed' {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    const encoded = readShareParam(window.location.hash);
    if (!encoded) return;
    applied.current = true;

    const shared = decodeCard(encoded, templateIds());
    if (!shared) {
      setState('failed');
      return;
    }

    setState('loading');
    hydrate(shared)
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  }, []);

  return state;
}

async function hydrate(shared: SharedCard): Promise<void> {
  const store = useCard.getState();
  const accepts = new Map(UI_SLOTS.map((s) => [s.id as string, s.accepts as Slot]));

  const neededSlots = [...new Set(shared.slots.map((s) => accepts.get(s.slot)).filter(Boolean))];
  const [catalogs, stains] = await Promise.all([
    Promise.all(neededSlots.map((slot) => loadSlot(slot as Slot))),
    shared.slots.some((s) => s.dyes.some(Boolean)) ? loadStains() : Promise.resolve([] as Stain[]),
  ]);

  const byId = new Map<string, Map<number, Item>>();
  neededSlots.forEach((slot, i) => {
    byId.set(slot as string, new Map(catalogs[i].map((entry) => [entry.item.id, entry.item])));
  });
  const stainById = new Map(stains.map((stain) => [stain.id, stain]));

  for (const entry of shared.slots) {
    const source = byId.get(accepts.get(entry.slot) ?? '');
    const item = source?.get(entry.itemId);
    // An id the current data no longer has — an item removed upstream, or a
    // link from a newer build — is skipped rather than failing the whole card.
    if (!item) continue;
    store.setItem(entry.slot as UiSlotId, item);
    entry.dyes.forEach((id, index) => {
      const stain = id ? stainById.get(id) : null;
      if (stain) store.setDye(entry.slot as UiSlotId, index as 0 | 1, stain);
    });
  }

  store.setMeta(shared.meta);
  store.setTemplateId(shared.templateId);
  store.setLayout(shared.layout);
  store.setDyeStyle(shared.dyeStyle);
  store.setCardTheme(shared.cardTheme);
  store.setShowSubNames(shared.showSubNames);
  store.setCardLang(shared.cardLang);
}

export function ShareBar({ lang }: { lang: Lang }) {
  const slots = useCard((s) => s.slots);
  const meta = useCard((s) => s.meta);
  const templateId = useCard((s) => s.templateId);
  const layout = useCard((s) => s.layout);
  const dyeStyle = useCard((s) => s.dyeStyle);
  const cardTheme = useCard((s) => s.cardTheme);
  const showSubNames = useCard((s) => s.showSubNames);
  const cardLang = useCard((s) => s.cardLang);
  const image = useCard((s) => s.image);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');

  async function share() {
    const encoded = encodeCard(
      {
        slots: UI_SLOTS.flatMap(({ id }) => {
          const state = slots[id];
          return state.item
            ? [{
                slot: id as string,
                itemId: state.item.id,
                dyes: [state.dyes[0]?.id ?? null, state.dyes[1]?.id ?? null] as [number | null, number | null],
              }]
            : [];
        }),
        meta,
        templateId,
        layout,
        dyeStyle,
        cardTheme,
        showSubNames,
        cardLang,
      },
      templateIds(),
    );

    const url = shareUrl(encoded);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused; the field below is the fallback.
      setCopied(false);
    }
  }

  return (
    <div>
      <button
        onClick={share}
        className="w-full rounded border border-rule px-3 py-1.5 text-xs text-fg-dim hover:border-[var(--accent)] hover:text-fg"
      >
        {copied ? t(lang, 'shareCopied') : t(lang, 'share')}
      </button>

      {link && (
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1.5 w-full rounded border border-rule bg-surface-sunken px-2 py-1 font-mono text-[10px] text-fg-dim"
        />
      )}

      <p className="mt-1.5 text-[11px] leading-relaxed text-fg-faint">
        {image ? t(lang, 'shareNoImage') : t(lang, 'shareHint')}
      </p>
    </div>
  );
}
