import { TEMPLATES } from '../card/registry.ts';
import type { Lang } from '../lib/catalog.ts';
import { t } from '../lib/i18n.ts';
import { LAYOUTS, resolveCardLang, useCard } from '../store/card.ts';
import { CARD_WIDTH, CardPreview } from './CardPreview.tsx';

const THUMB_WIDTH = 116;

/**
 * Template thumbnails, inline in the panel.
 *
 * Choosing a template used to mean opening a modal and picking from a grid —
 * two clicks and a lost view of the card. The templates are few and the
 * thumbnails are small, so they fit beside the other card settings and switch
 * on one click.
 *
 * Each thumbnail is the live card rendered small, not a stored screenshot. It
 * can never drift from the template, needs no assets, and shows the outfit
 * actually being edited.
 */
export function TemplatePicker({ lang }: { lang: Lang }) {
  const templateId = useCard((s) => s.templateId);
  const setTemplateId = useCard((s) => s.setTemplateId);
  const layout = useCard((s) => s.layout);
  const cardLang = resolveCardLang(useCard((s) => s.cardLang), lang);

  const scale = THUMB_WIDTH / CARD_WIDTH;
  const thumbHeight = THUMB_WIDTH / LAYOUTS[layout].ratio;

  return (
    <div className="grid grid-cols-2 gap-2">
      {TEMPLATES.map((tpl) => {
        const active = templateId === tpl.id;
        const untested = !tpl.languages.includes(cardLang);
        return (
          <button
            key={tpl.id}
            onClick={() => setTemplateId(tpl.id)}
            title={untested ? `${tpl.name[lang]} · ${t(lang, 'templateUntested')}` : tpl.name[lang]}
            className={`rounded border p-1 text-left ${
              active ? 'border-[var(--accent)]' : 'border-rule hover:border-rule-strong'
            }`}
          >
            <div
              style={{ width: THUMB_WIDTH, height: thumbHeight }}
              className="overflow-hidden bg-surface"
            >
              {/* Inert: the thumbnail must not steal clicks from the button. */}
              <div
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="pointer-events-none"
              >
                <CardPreview uiLang={lang} templateId={tpl.id} />
              </div>
            </div>
            <p
              className={`mt-1 truncate text-[10px] ${active ? 'text-fg' : 'text-fg-dim'}`}
            >
              {tpl.name[lang]}
              {untested && <span className="text-fg-faint"> ·</span>}
            </p>
          </button>
        );
      })}
    </div>
  );
}
