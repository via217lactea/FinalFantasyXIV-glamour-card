import { useState } from 'react';
import { UI_SLOTS, type Slot } from '../../scripts/slots.ts';
import { displayName, type Item, type Lang, type Stain } from '../lib/catalog.ts';
import { slotName, t } from '../lib/i18n.ts';
import { useCard, type UiSlotId } from '../store/card.ts';
import { ItemIcon } from './ItemIcon.tsx';
import { ItemSearch } from './ItemSearch.tsx';
import { DyePicker } from './DyePicker.tsx';

type Editing =
  | { kind: 'item'; slot: UiSlotId; accepts: Slot }
  | { kind: 'dye'; slot: UiSlotId; index: 0 | 1 }
  | null;

export function SlotRail({ lang }: { lang: Lang }) {
  const slots = useCard((s) => s.slots);
  const setItem = useCard((s) => s.setItem);
  const setDye = useCard((s) => s.setDye);
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div>
      <ul className="divide-y divide-rule/70">
        {UI_SLOTS.map(({ id, accepts }) => {
          const state = slots[id];
          const label = slotName(lang, id);
          return (
            <li key={id} className="flex items-center gap-3 py-2">
              <button
                onClick={() => setEditing({ kind: 'item', slot: id, accepts })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <ItemIcon iconId={state.item?.icon} size="40px" fallback={label.slice(0, 1)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] tracking-wider text-fg-faint">
                    {label}
                  </span>
                  <span
                    className={`block truncate text-sm ${
                      state.item ? 'text-fg' : 'text-fg-faint italic'
                    }`}
                  >
                    {state.item ? displayName(state.item.name, lang) : t(lang, 'emptySlot')}
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-1">
                {state.item &&
                  Array.from({ length: state.item.dyeCount }, (_, i) => i as 0 | 1).map((i) => (
                    <DyeChip
                      key={i}
                      stain={state.dyes[i]}
                      onClick={() => setEditing({ kind: 'dye', slot: id, index: i })}
                      label={`${label} · ${t(lang, 'dyeSlot')} ${i + 1}`}
                    />
                  ))}
                {state.item && (
                  <button
                    onClick={() => setItem(id, null)}
                    aria-label={`${label} ${t(lang, 'remove')}`}
                    title={t(lang, 'remove')}
                    className="ml-1 px-1 text-fg-faint hover:text-fg"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing?.kind === 'item' && (
        <ItemSearch
          slot={editing.accepts}
          slotLabel={slotName(lang, editing.slot)}
          lang={lang}
          onPick={(item: Item) => {
            setItem(editing.slot, item);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {editing?.kind === 'dye' && (
        <DyePicker
          lang={lang}
          label={`${slotName(lang, editing.slot)} · ${t(lang, 'dyeSlot')} ${editing.index + 1}`}
          current={slots[editing.slot].dyes[editing.index]}
          onPick={(stain: Stain | null) => {
            setDye(editing.slot, editing.index, stain);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DyeChip({
  stain,
  onClick,
  label,
}: {
  stain: Stain | null;
  onClick(): void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={stain ? { background: stain.hex } : undefined}
      className={`h-6 w-6 rounded-[3px] border ${
        stain
          ? 'border-[var(--c-swatch-edge)]'
          : 'border-dashed border-rule-strong bg-transparent hover:border-[var(--accent)]'
      }`}
    />
  );
}
