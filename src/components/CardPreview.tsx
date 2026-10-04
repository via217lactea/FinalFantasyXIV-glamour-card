import { forwardRef } from 'react';
import { UI_SLOTS } from '../../scripts/slots.ts';
import { findTemplate } from '../card/registry.ts';
import type { WornPiece } from '../card/types.ts';
import type { Lang } from '../lib/catalog.ts';
import { useFitToBox } from '../lib/fit.ts';
import { resolveCardTheme } from '../lib/theme.ts';
import { useVersions, versionFor } from '../lib/versions.ts';
import { LAYOUTS, resolveCardLang, useCard } from '../store/card.ts';

/**
 * The card's real pixel width. It is rendered at this size regardless of the
 * viewport — the editor scales it down for display — so the export is always
 * the same resolution and the two-column split has room for three languages.
 */
export const CARD_WIDTH = 960;

/**
 * Owns everything a card needs and hands it to whichever template is selected.
 * Templates decide only how the card looks.
 */
export const CardPreview = forwardRef<
  HTMLDivElement,
  { uiLang: Lang; templateId?: string }
>(function CardPreview({ uiLang, templateId: override }, ref) {
    const slots = useCard((s) => s.slots);
    const meta = useCard((s) => s.meta);
    const cardLang = resolveCardLang(useCard((s) => s.cardLang), uiLang);
    const showSubNames = useCard((s) => s.showSubNames);
    const dyeStyle = useCard((s) => s.dyeStyle);
    const image = useCard((s) => s.image);
    const imageFocus = useCard((s) => s.imageFocus);
    const imageZoom = useCard((s) => s.imageZoom);
    const layout = useCard((s) => s.layout);
    const theme = useCard((s) => s.theme);
    const cardTheme = useCard((s) => s.cardTheme);
    // An override lets the picker render the live card in every template.
    const templateId = useCard((s) => s.templateId);
    const versions = useVersions();

    const { ratio, imageShare } = LAYOUTS[layout];
    const template = findTemplate(override ?? templateId);

    const worn: WornPiece[] = [];
    const dyeColors: string[] = [];
    for (const { id } of UI_SLOTS) {
      const state = slots[id];
      if (state.item) worn.push({ slot: id, item: state.item, dyes: state.dyes });
      for (const dye of state.dyes) if (dye) dyeColors.push(dye.hex);
    }

    // Anything that changes the list's height has to retrigger the fit.
    // Past these counts a row cannot afford a line per part. The thresholds are
    // derived from the capacity model in scripts/check-capacity.ts.
    const density: 0 | 1 | 2 = worn.length >= 11 ? 2 : worn.length >= 8 ? 1 : 0;

    const signature = [
      layout, cardLang, showSubNames, dyeStyle, template.id, density, Boolean(image),
      worn.map((p) => `${p.item.id}:${p.dyes.map((d) => d?.id ?? '-')}`).join(),
    ].join('|');
    const fit = useFitToBox(signature);

    return (
      <div
        ref={ref}
        data-theme={resolveCardTheme(cardTheme, theme)}
        style={{ width: CARD_WIDTH, height: CARD_WIDTH / ratio + fit.extra }}
        className="relative"
      >
        <template.Component
          uiLang={uiLang}
          cardLang={cardLang}
          meta={meta}
          worn={worn}
          dyeCount={dyeColors.length}
          dyeColors={dyeColors}
          image={image}
          imageFocus={imageFocus}
          imageZoom={imageZoom}
          imageShare={imageShare}
          showSubNames={showSubNames}
          density={density}
          dyeStyle={dyeStyle}
          patch={versionFor(versions, cardLang)}
          fit={fit}
        />
      </div>
    );
});
