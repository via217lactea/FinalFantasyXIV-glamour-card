import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from '../lib/catalog.ts';
import { t } from '../lib/i18n.ts';
import { useCard } from '../store/card.ts';

/** Long edge cap. A 4K screenshot held at full size stalls a pixelRatio-3 export. */
const MAX_EDGE = 1600;

/**
 * Reads the file into a downscaled data URL. It must be a data URL rather than
 * an object URL: blob: sources can taint the canvas at export time, and the
 * export is the whole point of the tool.
 */
async function prepare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}

export function ImageDrop({ lang }: { lang: Lang }) {
  const image = useCard((s) => s.image);
  const setImage = useCard((s) => s.setImage);
  const setFocus = useCard((s) => s.setImageFocus);
  const zoom = useCard((s) => s.imageZoom);
  const setZoom = useCard((s) => s.setImageZoom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) return setError(t(lang, 'imageWrongType'));
      setBusy(true);
      setError(null);
      try {
        setImage(await prepare(file));
      } catch {
        setError(t(lang, 'imageFailed'));
      } finally {
        setBusy(false);
      }
    },
    [lang, setImage],
  );

  // Players screenshot and paste; make that work without hunting for a button.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const file = [...(event.clipboardData?.items ?? [])]
        .find((i) => i.type.startsWith('image/'))
        ?.getAsFile();
      if (file) accept(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [accept]);

  if (image) {
    return (
      <div>
        <FocusPad />
        <label className="mt-2 flex items-center gap-2 text-[11px] text-fg-dim">
          <span className="shrink-0">{t(lang, 'zoom')}</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="w-9 shrink-0 text-right font-mono">{zoom.toFixed(2)}×</span>
        </label>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex-1 rounded border border-rule px-2 py-1 text-xs text-fg-dim hover:border-rule-strong hover:text-fg"
          >
            {t(lang, 'imageReplace')}
          </button>
          <button
            onClick={() => setImage(null)}
            className="rounded border border-rule px-2 py-1 text-xs text-fg-dim hover:border-rule-strong hover:text-fg"
          >
            {t(lang, 'imageRemove')}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-fg-faint">
          {t(lang, 'imageDragHint')}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => {
            setFocus({ x: 50, y: 50 });
            setZoom(1);
          }}
          className="mt-1 text-[11px] text-fg-faint underline-offset-2 hover:text-fg-dim hover:underline"
        >
          {t(lang, 'imageRecenter')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded border border-dashed px-3 py-7 text-center transition-colors ${
          dragOver ? 'border-[var(--accent)] bg-surface-raised' : 'border-rule-strong hover:border-fg-faint'
        }`}
      >
        <span className="text-sm text-fg">
          {busy ? t(lang, 'imageWorking') : t(lang, 'imageAdd')}
        </span>
        <span className="text-[11px] text-fg-faint">{t(lang, 'imageHint')}</span>
      </button>
      {error && <p className="mt-1.5 text-[11px] text-fg-dim">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Drag inside the thumbnail to choose which part of the shot the card keeps. */
function FocusPad() {
  const image = useCard((s) => s.image);
  const focus = useCard((s) => s.imageFocus);
  const zoom = useCard((s) => s.imageZoom);
  const setFocus = useCard((s) => s.setImageFocus);
  const ref = useRef<HTMLDivElement>(null);

  function move(event: React.PointerEvent) {
    if (event.buttons !== 1 || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    setFocus({
      x: Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)),
    });
  }

  if (!image) return null;
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      className="relative aspect-4/3 w-full cursor-grab touch-none overflow-hidden rounded border border-rule active:cursor-grabbing"
    >
      <img
        src={image}
        alt=""
        draggable={false}
        style={{
          objectPosition: `${focus.x}% ${focus.y}%`,
          transform: zoom === 1 ? undefined : `scale(${zoom})`,
          transformOrigin: `${focus.x}% ${focus.y}%`,
        }}
        className="h-full w-full object-cover select-none"
      />
      <span
        style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
        className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fg shadow-[0_0_0_1px_rgba(0,0,0,.6)]"
      />
    </div>
  );
}
