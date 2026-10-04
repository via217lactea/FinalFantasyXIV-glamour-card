import { useLayoutEffect, useRef, useState } from 'react';
import { CARD_WIDTH } from './CardPreview.tsx';
import { isExporting } from '../lib/export.ts';

/**
 * Displays a card that is wider than the column it sits in.
 *
 * The card always renders at its true pixel size — the export must not depend
 * on the viewport — so only the presentation is transformed. A transform does
 * not change the layout box, which is why the outer element's size has to be
 * set from measurements rather than inherited.
 */
export function CardStage({ children }: { children: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: CARD_WIDTH * 0.75 });

  // No dependency array: the card's height changes with the ratio, the
  // template and the fitting pass, and re-syncing after every render is the
  // only way to catch all of them. Resizing the window while any of those is
  // mid-change is what left the wrapper holding a stale height and clipping
  // the card.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;

    const measure = () => {
      // The exporter removes the transform to capture at full size; reacting
      // to that would rescale the node mid-serialisation.
      if (isExporting()) return;
      const scale = Math.min(1, stage.clientWidth / CARD_WIDTH);
      // offsetHeight ignores transforms, so this is the card's true height.
      const height = card.offsetHeight;
      setBox((prev) =>
        Math.abs(prev.scale - scale) < 0.001 && prev.height === height ? prev : { scale, height },
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(card);
    return () => observer.disconnect();
  });

  return (
    <div ref={stageRef}>
      <div
        style={{ width: CARD_WIDTH * box.scale, height: box.height * box.scale }}
        className="overflow-hidden"
      >
        <div
          ref={cardRef}
          style={{
            width: CARD_WIDTH,
            transform: `scale(${box.scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
