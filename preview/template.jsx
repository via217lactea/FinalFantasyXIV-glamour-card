import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';

// Real catalog data, trimmed to the highest item levels per slot so the search
// has something to chew on. The shipping app loads the full 28,962 from
// /data/items/{slot}.json instead.
const DATA = /*__DATA__*/;

// Paper fibre. The opacity lives inside the SVG because this is applied as a
// plain element background here — keep it low, or the noise reads as static
// rather than texture.
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23f)' opacity='0.02'/%3E%3C/svg%3E\")";

const THEME_VARS = {
  // Off-white studio paper. Not pure #fff, which glares on a large bright
  // surface, but close enough to read as white.
  light: {
    '--c-surface': '#fbfaf9', '--c-surface-raised': '#ffffff', '--c-surface-sunken': '#f1efec',
    '--c-rule': '#e2ded9', '--c-rule-soft': '#ebe8e4', '--c-rule-strong': '#c2bcb4',
    '--c-fg': '#23211f', '--c-fg-dim': '#6d6862', '--c-fg-faint': '#a09a93',
    '--c-hover': '#f1efec', '--c-scrim': 'rgba(35,33,31,.4)',
    '--c-swatch-edge': 'rgba(35,33,31,.3)', '--fallback-accent': '#8a5a3c',
  },
  // A soft near-black rather than true black, so white type does not halo.
  dark: {
    '--c-surface': '#1c1b1a', '--c-surface-raised': '#232221', '--c-surface-sunken': '#141313',
    '--c-rule': '#35332f', '--c-rule-soft': '#2b2926', '--c-rule-strong': '#514d47',
    '--c-fg': '#f0eeea', '--c-fg-dim': '#b3ada5', '--c-fg-faint': '#837d75',
    '--c-hover': '#2b2926', '--c-scrim': 'rgba(20,19,19,.84)',
    '--c-swatch-edge': 'rgba(0,0,0,.45)', '--fallback-accent': '#c9a961',
  },
};const VERSIONS = { ko: '7.55', global: null };

/** Names in the languages the card is not printing in. */
function otherNames(n, primary) {
  return ['en', 'ja', 'ko'].filter((l) => l !== primary).map((l) => n[l]).filter(Boolean).join(' / ');
}


const DISPLAY = "'Gowun Batang', 'Nanum Myeongjo', serif";
// A high-contrast Didone is what makes a fashion masthead read as one.
const MASTHEAD = "'Bodoni Moda', 'Gowun Batang', serif";
// Title and signature. Plex splits by script, so all three families stack. The
// KR and JP faces sit on different baselines, which rules Plex out for body
// text where scripts share a line — but a title is one language at a time.
const TITLE = "'IBM Plex Sans', 'IBM Plex Sans KR', 'IBM Plex Sans JP', sans-serif";
const SANS = "'Pretendard Variable', Pretendard, system-ui, sans-serif";

const UI_SLOTS = [
  ['mainhand', 'mainhand'], ['offhand', 'offhand'], ['head', 'head'], ['body', 'body'],
  ['hands', 'hands'], ['legs', 'legs'], ['feet', 'feet'], ['earrings', 'earrings'],
  ['necklace', 'necklace'], ['bracelets', 'bracelets'], ['ring1', 'ring'], ['ring2', 'ring'],
  // Not from the Item sheet: facewear comes from Glasses, fashion accessories
  // from Ornament. Neither can be dyed.
  ['facewear', 'facewear'], ['ornament', 'ornament'],
];

const S = {
  ko: { app: '투영 카드 메이커', tag: '장비와 염색을 한 장에', equip: '장비', details: '카드 정보',
    search: '아이템 이름 또는 초성', none: '검색 결과가 없습니다', empty: '비어 있음', noDye: '염색 안 함',
    title: '코디명', untitled: '이름 없는 코디', char: '캐릭터 이름', world: '서버', job: '직업',
    cardLang: '카드 표기 언어', hint: '해외 공유용으로 카드만 영어로 둘 수 있습니다',
    emptyCard: '왼쪽에서 장비를 골라 시작하세요', pieces: '장비', colors: '색', clear: '전부 비우기', dye: '염색',
    image: '스크린샷', imageAdd: '스크린샷 올리기', imageHint: '끌어다 놓거나 붙여넣기(Ctrl+V)도 됩니다',
    imageReplace: '바꾸기', imageRemove: '지우기', imageDragHint: '끌어서 카드에 보일 부분을 정하세요', imageSlotHint: '스크린샷이 들어갈 자리', langAuto: '화면 따라', zoom: '확대',
    layout: '카드 비율', square: '정사각형', landscape: '가로', wide: '와이드',
    cardTheme: '카드 테마', auto: '화면 따라', light: '밝게', dark: '어둡게',
    eyebrow: '외형 정보', subNames: '다른 언어 이름 함께 표시', patch: '패치',
    cardStyle: '카드 형식', plain: '기본 카드', editorialStyle: '룩북', mastheadStyle: '매거진 표제', spreadStyle: '패션 스프레드', dyeStyle: '염색 표기', dyeSwatch: '색상 칩', dyeText: '이름만',
    model: '모델', collection: '글래머 컬렉션',
    reset: '전체 초기화', resetYes: '초기화', cancel: '취소', resetConfirm: '장비, 염색, 스크린샷, 카드 설정을 모두 처음 상태로 되돌립니다. 계속할까요?' },
  ja: { app: 'ミラプリカードメーカー', tag: '装備と染色を一枚に', equip: '装備', details: 'カード情報',
    search: 'アイテム名で検索', none: '見つかりませんでした', empty: '未設定', noDye: '染色なし',
    title: 'コーデ名', untitled: '無題のコーデ', char: 'キャラクター名', world: 'ワールド', job: 'ジョブ',
    cardLang: 'カード表記', hint: '海外向けにカードだけ英語にできます',
    emptyCard: '左から装備を選んでください', pieces: '装備', colors: '色', clear: 'すべて外す', dye: 'カラー',
    image: 'スクリーンショット', imageAdd: 'スクリーンショットを追加', imageHint: 'ドラッグ＆ドロップや貼り付けも使えます',
    imageReplace: '差し替え', imageRemove: '削除', imageDragHint: 'ドラッグして映す位置を決めます', imageSlotHint: 'スクリーンショットの位置', langAuto: '画面に合わせる', zoom: 'ズーム',
    layout: 'カード比率', square: '正方形', landscape: '横長', wide: 'ワイド',
    cardTheme: 'カードテーマ', auto: '画面に合わせる', light: 'ライト', dark: 'ダーク',
    eyebrow: '外見情報', subNames: '他言語の名前も表示', patch: 'パッチ',
    cardStyle: 'カード形式', plain: 'シンプル', editorialStyle: 'ルックブック', mastheadStyle: 'マガジン', spreadStyle: 'スプレッド', dyeStyle: 'カラー表記', dyeSwatch: 'カラーチップ', dyeText: '名前のみ',
    model: 'モデル', collection: 'グラマーコレクション',
    reset: 'すべてリセット', resetYes: 'リセット', cancel: 'キャンセル', resetConfirm: '装備・染色・スクリーンショット・カード設定をすべて初期状態に戻します。よろしいですか？' },
  en: { app: 'Glamour Card Maker', tag: 'Your gear and dyes on one card', equip: 'Equipment', details: 'Card details',
    search: 'Search item names', none: 'Nothing matched', empty: 'Empty', noDye: 'Undyed',
    title: 'Outfit name', untitled: 'Untitled outfit', char: 'Character name', world: 'World', job: 'Job',
    cardLang: 'Card language', hint: 'Keep the card in English to share it abroad',
    emptyCard: 'Pick a piece on the left to begin', pieces: 'pieces', colors: 'colors', clear: 'Clear all', dye: 'Dye',
    image: 'Screenshot', imageAdd: 'Add a screenshot', imageHint: 'Drop a file here, or paste with Ctrl+V',
    imageReplace: 'Replace', imageRemove: 'Remove', imageDragHint: 'Drag to choose what the card keeps in frame', imageSlotHint: 'Your screenshot goes here', langAuto: 'Match interface', zoom: 'Zoom',
    layout: 'Card shape', square: 'Square', landscape: 'Landscape', wide: 'Wide',
    cardTheme: 'Card theme', auto: 'Match interface', light: 'Light', dark: 'Dark',
    eyebrow: 'Appearance', subNames: 'Show names in other languages', patch: 'Patch',
    cardStyle: 'Card style', plain: 'Plain card', editorialStyle: 'Lookbook', mastheadStyle: 'Masthead', spreadStyle: 'Spread', dyeStyle: 'Dye display', dyeSwatch: 'Swatches', dyeText: 'Names only',
    model: 'Model', collection: 'Glamour Collection',
    reset: 'Reset everything', resetYes: 'Reset', cancel: 'Cancel', resetConfirm: 'This returns gear, dyes, the screenshot and every card setting to their defaults. Continue?' },
};

const SLOT_NAME = {
  ko: { mainhand: '무기', offhand: '보조 무기', head: '머리', body: '몸통', hands: '손', legs: '다리',
    feet: '발', earrings: '귀걸이', necklace: '목걸이', bracelets: '팔찌', ring1: '반지 1', ring2: '반지 2',
    facewear: '안경', ornament: '패션 아이템' },
  ja: { mainhand: 'メインアーム', offhand: 'サブアーム', head: '頭', body: '胴', hands: '手', legs: '脚',
    feet: '足', earrings: '耳', necklace: '首', bracelets: '腕', ring1: '指 1', ring2: '指 2',
    facewear: 'フェイスウェア', ornament: 'ファッションアイテム' },
  en: { mainhand: 'Main hand', offhand: 'Off hand', head: 'Head', body: 'Body', hands: 'Hands', legs: 'Legs',
    feet: 'Feet', earrings: 'Earrings', necklace: 'Necklace', bracelets: 'Bracelets', ring1: 'Ring 1', ring2: 'Ring 2',
    facewear: 'Facewear', ornament: 'Fashion accessory' },
};

const SHADE = {
  2: { ko: '무채색', ja: 'モノトーン', en: 'Neutral' }, 4: { ko: '붉은 계열', ja: 'レッド系', en: 'Reds' },
  5: { ko: '갈색 계열', ja: 'ブラウン系', en: 'Browns' }, 6: { ko: '노란 계열', ja: 'イエロー系', en: 'Yellows' },
  7: { ko: '녹색 계열', ja: 'グリーン系', en: 'Greens' }, 8: { ko: '파란 계열', ja: 'ブルー系', en: 'Blues' },
  9: { ko: '보라 계열', ja: 'パープル系', en: 'Purples' }, 10: { ko: '특수 염료', ja: '特殊染料', en: 'Special' },
};

const LAYOUTS = { square: [1, 0.5], landscape: [4 / 3, 0.52], wide: [16 / 9, 0.55] };
const CARD_W = 960;   // true export width; the stage scales it down for display

const MIN_SCALE = 0.56;   // the card exports at 2-3x, where this still reads
const MAX_SCALE = 1.35;   // above this a two-piece outfit sets like a headline
const BASE_PX = 16;
const EM = { name: 0.8125, sub: 0.625, dye: 0.594 };

/**
 * Largest scale whose measured height fits, plus any extra height still needed
 * when even the floor overflows. Measured rather than calculated: names wrap
 * differently at every size, so height is a staircase, not a straight line.
 */
/**
 * Searches upward as well as down, so a short list grows to meet the bottom of
 * its box instead of leaving the card half-drawn.
 */
function fitScale(measure, available) {
  if (available <= 0) return { scale: 1, extra: 0 };
  let lo = MIN_SCALE, hi = MAX_SCALE, best = MIN_SCALE, bestHeight = Infinity;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const h = measure(mid);
    if (h <= available) { best = mid; bestHeight = h; lo = mid; } else { hi = mid; }
  }
  if (bestHeight <= available) return { scale: best, extra: 0 };
  return { scale: MIN_SCALE, extra: Math.max(0, measure(MIN_SCALE) - available) };
}

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const norm = (s) => s.toLowerCase().replace(/[\s'’·・-]/g, '');
const initials = (s) => [...s].map((ch) => {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
}).join('');

const name = (n, lang) => n[lang] || n.ja || n.en || '';

function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  return { s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
}
function accentFrom(strip) {
  let best = 'var(--fallback-accent)', score = 0.18;  // theme supplies the fallback
  for (const st of strip) {
    const { s, l } = hsl(st.hex);
    const v = s * (1 - Math.abs(l - 0.55) * 1.6);
    if (v > score) { score = v; best = st.hex; }
  }
  return best;
}

const STAINS = DATA.stains.map(([id, hex, shade, ko, ja, en]) => ({ id, hex, shade, name: { ko, ja, en } }));
const CATALOG = {};
for (const [slot, rows] of Object.entries(DATA.items)) {
  CATALOG[slot] = rows.map(([id, dyeCount, en, ja, ko]) => ({
    id, dyeCount, name: { en, ja, ko },
    hay: { ko: norm(ko || ''), ja: norm(ja || ''), en: norm(en || '') },
    cho: initials(norm(ko || '')),
  }));
}

function search(slot, q, lang) {
  const list = CATALOG[slot] || [];
  const query = norm(q);
  if (!query) return list;
  const bare = q.replace(/\s/g, '');
  const choQ = /^[ㄱ-ㅎ]+$/.test(bare) ? bare : null;
  const order = [lang, ...['ko', 'ja', 'en'].filter((l) => l !== lang)];
  const out = [];
  for (const e of list) {
    let best = 0;
    if (choQ) {
      if (e.cho.startsWith(choQ)) best = 2; else if (e.cho.includes(choQ)) best = 1;
    } else {
      order.forEach((l, i) => {
        const h = e.hay[l];
        if (!h) return;
        if (h === query) best = Math.max(best, 10 - i);
        else if (h.startsWith(query)) best = Math.max(best, 7 - i);
        else if (h.includes(query)) best = Math.max(best, 4 - i);
      });
    }
    if (best) out.push({ e, best });
  }
  return out.sort((a, b) => b.best - a.best).map((x) => x.e);
}


// --- editorial furniture ---------------------------------------------------
// Trim marks and barcode are generated geometry, not assets: the PNG exporter
// cannot fetch anything external.
const EDITORIAL_INSET = 58;
const MARK = { offset: 22, length: 34, gap: 12 };

function TrimMarks() {
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]];
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {corners.map(([cx, cy], i) => (
        <div key={i} style={{ position: 'absolute', width: MARK.offset + MARK.length,
          height: MARK.offset + MARK.length,
          [cx ? 'right' : 'left']: 0, [cy ? 'bottom' : 'top']: 0 }}>
          <span style={{ position: 'absolute', width: 1, height: MARK.length,
            background: 'var(--c-fg-faint)', opacity: 0.45,
            [cx ? 'right' : 'left']: MARK.offset, [cy ? 'bottom' : 'top']: MARK.gap }} />
          <span style={{ position: 'absolute', height: 1, width: MARK.length,
            background: 'var(--c-fg-faint)', opacity: 0.45,
            [cx ? 'right' : 'left']: MARK.gap, [cy ? 'bottom' : 'top']: MARK.offset }} />
        </div>
      ))}
    </div>
  );
}

/** Deterministic, so the bars do not reshuffle on every keystroke. */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decorative only — it encodes nothing and is not meant to scan. */
/**
 * A weight bar in the colours the outfit uses. With no dyes it falls back to
 * black-to-white, which is what a print proof carries as a density strip.
 */
function dyeGradient(colors) {
  const stops = colors.length >= 2 ? colors
    : colors.length === 1 ? [colors[0], '#ffffff'] : ['#111111', '#ffffff'];
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** Hairlines run diagonally across the corners, as a proof sheet is marked. */
function CornerRules() {
  return (
    <svg aria-hidden="true" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <line x1="0" y1="76" x2="76" y2="0" stroke="var(--c-fg-faint)" strokeWidth="0.75" opacity="0.5" />
      <line x1="0" y1="112" x2="112" y2="0" stroke="var(--c-fg-faint)" strokeWidth="0.75" opacity="0.3" />
      <line x1="100%" y1="calc(100% - 76px)" x2="calc(100% - 76px)" y2="100%"
        stroke="var(--c-fg-faint)" strokeWidth="0.75" opacity="0.5" />
    </svg>
  );
}

function Barcode({ label, width = 104, height = 40 }) {
  const bars = useMemo(() => {
    let seed = 0x1f2e;
    for (const ch of label) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const random = mulberry32(seed);
    const out = [];
    let x = 0;
    while (x < width - 2) {
      const w = random() < 0.28 ? 3 : random() < 0.5 ? 2 : 1;
      out.push({ x, w });
      x += w + (random() < 0.4 ? 2 : 1);
    }
    return out;
  }, [label, width]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="var(--c-fg)" opacity="0.82" />
      ))}
    </svg>
  );
}

/**
 * The screenshot's place on the card, held open whether or not one is set.
 * An empty card that simply omits the image reads as a finished design with no
 * picture in it; reserving the space shows where the screenshot will land.
 */
function ImageSlot({ image, focus, zoom = 1, share, hint, style = {} }) {
  return (
    <div style={{ flex: `0 0 ${share * 100}%`, position: 'relative', overflow: 'hidden', ...style }}>
      {image ? (
        <img src={image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: `${focus.x}% ${focus.y}%`,
          transform: zoom === 1 ? undefined : `scale(${zoom})`,
          transformOrigin: `${focus.x}% ${focus.y}%` }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          border: '1px dashed var(--c-rule-strong)',
          background: 'color-mix(in srgb, var(--c-surface-sunken) 40%, transparent)' }}>
          {/* A framed mountain: the long-standing shorthand for a picture. */}
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--c-fg-faint)"
            strokeWidth="1.2" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
            <circle cx="8.5" cy="9.5" r="1.4" />
            <path d="M3.5 16.5 L9 11.5 L13 15 L16 12.5 L20.5 17" strokeLinejoin="round" />
          </svg>
          <p style={{ margin: 0, padding: '0 12px', textAlign: 'center', fontSize: 11,
            lineHeight: 1.4, color: 'var(--c-fg-faint)' }}>{hint}</p>
        </div>
      )}
    </div>
  );
}

/**
 * One row of a gear list. It sheds lines as the outfit grows: first the dye
 * names move onto the secondary line, then the secondary line moves up beside
 * the name. Fourteen pieces cannot afford three lines each on a 16:9 card, and
 * folding beats shrinking the type past readability.
 */
function GearLine({ item, dyes, lang, showSub, density, dyeStyle, nameEm = EM.name, nameStyle = {}, subStyle = {} }) {
  const secondary = showSub ? otherNames(item.name, lang) : '';
  const colours = dyes.filter(Boolean).map((d) => name(d.name, lang));
  const foldDyes = density >= 1 && colours.length > 0;
  const sub = [secondary, foldDyes ? colours.join(' | ') : ''].filter(Boolean).join('  ·  ');
  const foldSub = density >= 2 && Boolean(sub);
  const clip = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <>
      <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: '0.5em',
        fontSize: `${nameEm}em`, lineHeight: 1.35, ...clip, ...nameStyle }}>
        <span style={{ flexShrink: 0 }}>{name(item.name, lang)}</span>
        {foldSub && (
          <span style={{ minWidth: 0, fontSize: `${EM.sub / nameEm}em`, fontWeight: 400,
            color: 'var(--c-fg-faint)', ...clip, ...subStyle }}>{sub}</span>
        )}
      </p>
      {!foldSub && sub && (
        <p style={{ margin: 0, fontSize: `${EM.sub}em`, lineHeight: 1.35,
          color: 'var(--c-fg-faint)', ...clip, ...subStyle }}>{sub}</p>
      )}
      {!foldDyes && colours.length > 0 && (dyeStyle === 'text' ? (
        <p style={{ margin: '0.2em 0 0', fontFamily: DISPLAY, fontSize: `${EM.dye}em`,
          color: 'var(--c-fg-dim)', ...clip }}>{colours.join('  |  ')}</p>
      ) : (
        <p style={{ margin: '0.3em 0 0', display: 'flex', flexWrap: 'wrap', gap: '0.3em' }}>
          {dyes.map((d, i) => d && (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em',
              border: '1px solid var(--c-rule)', borderRadius: '0.25em', padding: '0.15em 0.45em',
              fontSize: `${EM.dye}em`, lineHeight: 1.4, color: 'var(--c-fg-dim)' }}>
              <span style={{ width: '1.05em', height: '1.05em', borderRadius: '0.15em',
                background: d.hex, border: '1px solid var(--c-swatch-edge)' }} />
              {i + 1} - {name(d.name, lang)}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function RuleLine({ left, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      borderBottom: '1px solid var(--c-fg)', paddingBottom: 4, fontSize: 8,
      letterSpacing: '.2em', textTransform: 'uppercase' }}>
      <span>{left}</span>{right && <span>{right}</span>}
    </div>
  );
}

/**
 * Any size used inside the gear list must be em: the fitting pass resizes the
 * list by changing its font-size, and a pixel value would not follow — the
 * measured height would then not match what actually renders, and rows would
 * overflow a box the measurement called a fit.
 */
function Frame({ size, label }) {
  return (
    <span style={{ width: size, height: size, minWidth: size, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', borderRadius: 3,
      border: `1px solid var(--c-rule)`, background: 'var(--c-surface-sunken)', color: 'var(--c-fg-faint)',
      fontFamily: DISPLAY, fontSize: '0.38em', userSelect: 'none' }}>
      {label}
    </span>
  );
}

function Modal({ children, onClose, label }) {
  return (
    <div onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'var(--c-scrim)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16 }}>
      <div role="dialog" aria-label={label}
        style={{ width: '100%', maxWidth: 460, maxHeight: '82%', display: 'flex', flexDirection: 'column',
          background: 'var(--c-surface-raised)', border: `1px solid var(--c-rule-strong)`, borderRadius: 8, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

export default function GlamourCardPreview({ __seed, __style, __dyeStyle, __uiLang, __image, __zoom }) {
  const [uiLang, setUiLang] = useState(__uiLang ?? 'ko');
  const [cardLangPref, setCardLangPref] = useState('auto');
  const [slots, setSlots] = useState(() => {
    const empty = Object.fromEntries(UI_SLOTS.map(([id]) => [id, { item: null, dyes: [null, null] }]));
    return __seed ? { ...empty, ...__seed(CATALOG, STAINS) } : empty;
  });
  const [meta, setMeta] = useState({ title: '', characterName: '', world: '', job: '' });
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [hoverDye, setHoverDye] = useState(null);
  const [image, setImage] = useState(__image ?? null);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(__zoom ?? 1);
  const [layout, setLayout] = useState('landscape');
  const [theme, setTheme] = useState('light');
  const [cardTheme, setCardTheme] = useState('auto');
  const [cardStyle, setCardStyle] = useState(__style ?? 'editorial');
  const [dyeStyle, setDyeStyle] = useState(__dyeStyle ?? 'swatch');
  const [subNames, setSubNames] = useState(true);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [fit, setFit] = useState({ scale: 1, extra: 0 });
  const [stage, setStage] = useState(1);
  const stageRef = useRef(null);
  const listBoxRef = useRef(null);
  const listRef = useRef(null);
  const extraRef = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const padRef = useRef(null);
  const cardLang = cardLangPref === 'auto' ? uiLang : cardLangPref;
  const T = S[uiLang];

  useEffect(() => { if (editing?.kind === 'item') { setQuery(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [editing]);

  // Individual colours belong to their piece; a card-wide colour bar competed
  // with the screenshot for attention, so only the count survives.
  const strip = useMemo(() => {
    const out = [];
    for (const [id] of UI_SLOTS) for (const d of slots[id].dyes) if (d) out.push(d);
    return out;
  }, [slots]);
  const accent = accentFrom(strip);
  const dyeColors = strip.map((d) => d.hex);

  const results = useMemo(
    () => (editing?.kind === 'item' ? search(editing.accepts, query, uiLang).slice(0, 60) : []),
    [editing, query, uiLang]);

  // Downscaled data URL, never an object URL — blob: sources can taint the
  // canvas when the card is exported.
  async function readImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * scale);
    cv.height = Math.round(bmp.height * scale);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close();
    setImage(cv.toDataURL('image/jpeg', 0.9));
    setFocus({ x: 50, y: 50 });
    setZoom(1);
  }

  useEffect(() => {
    const onPaste = (e) => {
      const el = e.target;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      const f = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
      if (f) readImage(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  function movePad(e) {
    if (e.buttons !== 1 || !padRef.current) return;
    const b = padRef.current.getBoundingClientRect();
    setFocus({
      x: Math.min(100, Math.max(0, ((e.clientX - b.left) / b.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - b.top) / b.height) * 100)),
    });
  }

  // The interface language and the app's light/dark choice survive a reset:
  // those are how you use the tool, not part of the card you are making.
  // No window.confirm: blocking dialogs are suppressed in sandboxed frames,
  // where the call returns undefined and the reset silently never runs.
  function resetAll() {
    setConfirmingReset(false);
    setSlots(Object.fromEntries(UI_SLOTS.map(([id]) => [id, { item: null, dyes: [null, null] }])));
    setMeta({ title: '', characterName: '', world: '', job: '' });
    setImage(null);
    setFocus({ x: 50, y: 50 });
    setZoom(1);
    setLayout('landscape');
    setCardTheme('auto');
    setCardStyle('editorial');
    setDyeStyle('swatch');
    setSubNames(true);
    setCardLangPref('auto');
  }

  function setItem(id, item) {
    setSlots((s) => ({ ...s, [id]: { item,
      dyes: [(item?.dyeCount ?? 0) >= 1 ? s[id].dyes[0] : null, (item?.dyeCount ?? 0) >= 2 ? s[id].dyes[1] : null] } }));
  }
  function setDye(id, i, stain) {
    setSlots((s) => { const d = [...s[id].dyes]; d[i] = stain; return { ...s, [id]: { ...s[id], dyes: d } }; });
  }

  const worn = UI_SLOTS.filter(([id]) => slots[id].item);
  // Thresholds mirror src/components/CardPreview.tsx; scripts/check-capacity.ts
  // is what derives them.
  const density = worn.length >= 11 ? 2 : worn.length >= 8 ? 1 : 0;

  const editorial = cardStyle === 'editorial';
  const masthead = cardStyle === 'masthead';
  const spread = cardStyle === 'spread';
  const cardH = CARD_W / LAYOUTS[layout][0] + fit.extra;

  // Anything that changes the list's height has to retrigger the measurement.
  const signature = [layout, cardLang, subNames, Boolean(image), theme, cardTheme, cardStyle,
    worn.map(([id]) => `${slots[id].item?.id}:${slots[id].dyes.map((d) => d?.id ?? '-')}`).join()].join('|');

  useLayoutEffect(() => {
    const box = listBoxRef.current;
    if (!box || !listRef.current) return;
    let cancelled = false;
    const run = () => {
      if (cancelled || !listBoxRef.current || !listRef.current) return;
      // A hair of slack absorbs sub-pixel rounding between measuring and
      // painting — the difference between a clean fit and a clipped last row.
      const available = listBoxRef.current.clientHeight - extraRef.current - 1;
      const next = fitScale((sc) => {
        listRef.current.style.fontSize = `${sc * BASE_PX}px`;
        // getBoundingClientRect keeps the fraction and the last child's bottom
        // margin; scrollHeight rounds down and drops it.
        return Math.ceil(listRef.current.getBoundingClientRect().height);
      }, available);
      listRef.current.style.fontSize = '';
      extraRef.current = next.extra;
      setFit((prev) =>
        Math.abs(prev.scale - next.scale) < 0.002 && prev.extra === next.extra ? prev : next);
    };
    run();
    // Measuring before the webfonts land reads fallback metrics; the text then
    // reflows larger and overflows a box that measured as fitting.
    document.fonts?.ready.then(run);
    const ro = new ResizeObserver(run);
    ro.observe(box);
    return () => { cancelled = true; ro.disconnect(); };
  }, [signature]);

  // The card renders at its real size and is only scaled for display, so what
  // would be exported never depends on how wide this panel happens to be.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStage(Math.min(1, el.clientWidth / CARD_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const identity = [meta.characterName, meta.world].filter(Boolean).join(' @ ');
  const dyeGroups = useMemo(() => {
    const m = new Map();
    for (const st of STAINS) { const l = m.get(st.shade) || []; l.push(st); m.set(st.shade, l); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  const field = (key, label) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-fg-faint)', marginBottom: 4 }}>{label}</span>
      <input value={meta[key]} onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--c-surface-sunken)', color: 'var(--c-fg)',
          border: `1px solid var(--c-rule)`, borderRadius: 4, padding: '6px 10px', fontSize: 13, fontFamily: SANS, outline: 'none' }} />
    </label>
  );

  const langBtn = (id, label, active, onClick) => (
    <button key={id} onClick={onClick}
      style={{ flex: 1, background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 11,
        padding: '4px 6px', borderRadius: 4, color: active ? 'var(--c-fg)' : 'var(--c-fg-dim)',
        border: `1px solid ${active ? accent : 'var(--c-rule)'}` }}>{label}</button>
  );

  return (
    <div style={{ ...THEME_VARS[theme], position: 'relative', background: 'var(--c-surface-sunken)',
      color: 'var(--c-fg)', fontFamily: SANS, borderRadius: 8, overflow: 'hidden', colorScheme: theme,
      backgroundImage: GRAIN }}>
      <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600&family=IBM+Plex+Sans+JP:wght@400;500;600&display=swap" rel="stylesheet" />

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '12px 18px', borderBottom: `1px solid var(--c-rule)` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 17, fontWeight: 400 }}>{T.app}</h1>
          <span style={{ fontSize: 11, color: 'var(--c-fg-faint)' }}>{T.tag}</span>
          {(uiLang === 'ko' ? VERSIONS.ko : VERSIONS.global) && (
            <span style={{ border: '1px solid var(--c-rule)', borderRadius: 99, padding: '1px 8px',
              fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--c-fg-faint)' }}>
              {T.patch} {uiLang === 'ko' ? VERSIONS.ko : VERSIONS.global}
            </span>
          )}
        </div>
        <nav style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="theme" title="theme"
            style={{ background: 'transparent', cursor: 'pointer', fontSize: 12, marginRight: 6,
              padding: '2px 7px', borderRadius: 4, color: 'var(--c-fg-dim)',
              border: '1px solid var(--c-rule)' }}>{theme === 'dark' ? '☾' : '☀'}</button>
          {['ko', 'ja', 'en'].map((l) => (
            <button key={l} onClick={() => setUiLang(l)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS,
                fontSize: 11, padding: '2px 6px', color: uiLang === l ? 'var(--c-fg)' : 'var(--c-fg-faint)' }}>
              {l === 'ko' ? '한국어' : l === 'ja' ? '日本語' : 'English'}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ padding: 18 }}>
        <div ref={stageRef} style={{ marginBottom: 22 }}>
        <div style={{ width: CARD_W * stage, height: cardH * stage, overflow: 'hidden' }}>
        <div style={{ transform: `scale(${stage})`, transformOrigin: 'top left' }}>
          <div style={{ ...THEME_VARS[cardTheme === 'auto' ? theme : cardTheme],
            // Fixed height: the list shrinks to fit rather than the card growing.
            // Past the readability floor fitScale() hands back extra height.
            width: CARD_W, height: cardH, position: 'relative', overflow: 'hidden',
            background: editorial ? 'var(--c-surface-raised)' : 'var(--c-surface)',
            ...(editorial ? {} : { display: 'flex', backgroundImage: GRAIN,
              border: `1px solid var(--c-rule-strong)`, borderRadius: 12 }) }}>

            {spread ? (
              <div style={{ display: 'flex', width: '100%', height: '100%',
                padding: '36px 44px 40px', boxSizing: 'border-box',
                background: 'var(--c-surface-raised)' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingRight: 36 }}>
                  <div style={{ borderBottom: '1px solid var(--c-fg)', opacity: .7, paddingBottom: 4 }} />
                  <p style={{ margin: '16px 0 0', fontFamily: MASTHEAD, fontSize: 64, lineHeight: .8,
                    fontWeight: 500, letterSpacing: '-.02em' }}>EORZEA</p>

                  {/* Setting matter, ruled into columns the way a masthead block is. */}
                  <div style={{ display: 'flex', marginTop: 12, border: '1px solid var(--c-fg)',
                    borderColor: 'color-mix(in srgb, var(--c-fg) 70%, transparent)',
                    fontSize: 7.5, lineHeight: 1.5, color: 'var(--c-fg-dim)' }}>
                    <div style={{ flexShrink: 0, padding: '6px 8px',
                      borderRight: '1px solid color-mix(in srgb, var(--c-fg) 70%, transparent)' }}>
                      <p style={{ margin: 0, fontWeight: 600, letterSpacing: '.05em',
                        textTransform: 'uppercase', color: 'var(--c-fg)' }}>Firstlook</p>
                      <p style={{ margin: '2px 0 0', fontFamily: 'ui-monospace, monospace' }}>
                        {(cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global)
                          ? `PATCH ${cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global}` : 'GLAMOUR'}
                      </p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, padding: '6px 8px',
                      borderRight: '1px solid color-mix(in srgb, var(--c-fg) 70%, transparent)' }}>
                      {meta.title && <p style={{ margin: 0, color: 'var(--c-fg)', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.title}</p>}
                      {[meta.characterName, meta.world, meta.job].filter(Boolean).length > 0 && (
                        <p style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[meta.characterName, meta.world, meta.job].filter(Boolean).join('  ·  ')}
                        </p>
                      )}
                      <p style={{ margin: 0 }}>
                        {worn.length} {S[cardLang].pieces}
                        {strip.length > 0 ? `  ·  ${strip.length} ${S[cardLang].colors}` : ''}
                      </p>
                    </div>
                    <div style={{ width: 74, flexShrink: 0, padding: '6px 8px' }}>
                      <p style={{ margin: 0 }}>FINAL FANTASY XIV</p>
                      <p style={{ margin: 0 }}>© SQUARE ENIX CO., LTD.</p>
                      <p style={{ margin: 0 }}>All Rights Reserved.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 16, marginTop: 28 }}>
                    <p style={{ margin: 0, fontSize: 19, lineHeight: 1, fontWeight: 700,
                      letterSpacing: '-.02em' }}>EORZEA FASHION</p>
                    {/* The ruled box above is 7.5px, too small to carry a name,
                        so the signature gets its own line. */}
                    {/* Always present, like the title slot elsewhere — an empty
                        card should still show where the name will sit. */}
                    <p style={{ margin: 0, minWidth: 0, fontFamily: TITLE, fontSize: 16, lineHeight: 1,
                      color: 'var(--c-fg-dim)', whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis' }}>
                      {meta.title || meta.characterName || T.untitled}
                    </p>
                  </div>
                  <div style={{ borderBottom: '1px solid var(--c-fg)', opacity: .7, marginTop: 8 }} />

                  <div ref={listBoxRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 12 }}>
                    {worn.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--c-fg-faint)' }}>{T.emptyCard}</p>
                    ) : (
                      <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0,
                        fontSize: `${fit.scale * BASE_PX}px` }}>
                        {worn.map(([id]) => {
                          const { item, dyes } = slots[id];
                          return (
                            <li key={id} style={{ marginBottom: '0.55em' }}>
                              <GearLine item={item} dyes={dyes} lang={cardLang} showSub={subNames}
                                density={density} dyeStyle={dyeStyle} nameEm={EM.name * 1.18} nameStyle={{ fontFamily: DISPLAY }} subStyle={{ fontFamily: DISPLAY, color: 'var(--c-fg-dim)' }} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                </div>
                <ImageSlot image={image} focus={focus} zoom={zoom} share={LAYOUTS[layout][1]} hint={T.imageSlotHint} style={{ background: 'var(--c-surface-sunken)' }} />
              </div>
            ) : masthead ? (
              <>
                <ImageSlot image={image} focus={focus} zoom={zoom} share={LAYOUTS[layout][1]} hint={T.imageSlotHint} style={{ background: 'var(--c-surface-sunken)' }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                  padding: '24px 32px 28px' }}>
                  <RuleLine left="First Look" right="For Final Fantasy XIV" />

                  {/* Oversized Didone with a ghosted italic behind it. */}
                  <div style={{ position: 'relative', marginTop: 16 }}>
                    <span style={{ position: 'absolute', top: -16, left: 4, fontFamily: MASTHEAD,
                      fontSize: 46, lineHeight: 1, fontStyle: 'italic', color: 'var(--c-fg)',
                      opacity: .1, pointerEvents: 'none' }}>Eorzea</span>
                    <p style={{ margin: 0, position: 'relative', fontFamily: MASTHEAD, fontSize: 62,
                      lineHeight: .82, fontWeight: 500, textAlign: 'center', letterSpacing: '-.01em' }}>EORZEA</p>
                  </div>
                  <div style={{ borderTop: '1px solid var(--c-fg)', marginTop: 12 }} />
                  <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 9,
                    letterSpacing: '.5em', textTransform: 'uppercase' }}>Fashion Collection</p>

                  <p style={{ margin: '20px 0 0', textAlign: 'right', fontFamily: TITLE, fontWeight: 500, fontSize: 20,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {meta.title || T.untitled}
                  </p>
                  <div style={{ borderBottom: '1px solid var(--c-fg)', opacity: .7, marginTop: 4 }} />

                  <div style={{ marginTop: 16 }}><RuleLine left="New Outfit" right="First Look //" /></div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginTop: 16 }}>
                    {/* Boxed letters, borrowed from a garment size tag. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {['S', 'M', 'L'].map((sz) => (
                        <span key={sz} style={{ width: 19, height: 19, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', border: '1px solid var(--c-fg)',
                          fontSize: 9, lineHeight: 1 }}>{sz}</span>
                      ))}
                    </div>
                    {/* Weight bar, arrow and barcode stack down the right half,
                        the way a print proof lays out its density strip. */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'flex-end', gap: 6 }}>
                      <div style={{ height: 11, width: '100%', backgroundImage: dyeGradient(dyeColors) }} />
                      <span style={{ fontSize: 13, lineHeight: 1 }}>↘</span>
                      <Barcode label={`${meta.title}${meta.characterName}`} width={148} height={26} />
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}><RuleLine left="List." /></div>

                  <div ref={listBoxRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 8 }}>
                    {worn.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--c-fg-faint)' }}>{T.emptyCard}</p>
                    ) : (
                      <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0,
                        fontSize: `${fit.scale * BASE_PX}px` }}>
                        {worn.map(([id]) => {
                          const { item, dyes } = slots[id];
                          return (
                            <li key={id} style={{ marginBottom: '0.45em' }}>
                              <GearLine item={item} dyes={dyes} lang={cardLang} showSub={subNames}
                                density={density} dyeStyle={dyeStyle} nameStyle={{ fontFamily: DISPLAY }} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    marginTop: 12, fontSize: 8, color: 'var(--c-fg-faint)' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, lineHeight: 1, color: 'var(--c-fg)' }}>✳</p>
                      <p style={{ margin: '6px 0 0', fontFamily: TITLE, fontSize: 11,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[meta.characterName, meta.world, meta.job].filter(Boolean).join('  ·  ')}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ margin: 0 }}>FINAL FANTASY XIV © SQUARE ENIX CO., LTD.</p>
                      <p style={{ margin: 0 }}>All Rights Reserved.</p>
                      {(cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global) && (
                        <p style={{ margin: '2px 0 0', fontFamily: 'ui-monospace, monospace',
                          letterSpacing: '.18em' }}>PATCH {cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : editorial ? (
              <>
                <TrimMarks />
                <CornerRules />
                {/* A rule box just inside the trim, and a vertical rule splitting
                    the picture from the copy — proof-sheet furniture. */}
                <div style={{ position: 'absolute', inset: EDITORIAL_INSET - 20,
                  borderLeft: '1px solid var(--c-rule)', borderRight: '1px solid var(--c-rule)',
                  pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', inset: EDITORIAL_INSET, display: 'flex', gap: 38 }}>
                  <ImageSlot image={image} focus={focus} zoom={zoom} share={LAYOUTS[layout][1]} hint={T.imageSlotHint} style={{ border: '1px solid var(--c-rule)' }} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                    borderLeft: '1px solid var(--c-rule)', paddingLeft: 24 }}>
                    {/* The outfit is what the card is about, so its name leads.
                        The model, then the world and job, step down from there. */}
                    <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 10, letterSpacing: '.34em',
                      textTransform: 'uppercase', color: 'var(--c-fg-faint)' }}>{S[cardLang].collection}</p>
                    <p style={{ margin: '4px 0 0', fontFamily: TITLE, fontWeight: 500, fontSize: 26,
                      lineHeight: 1, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis' }}>{meta.title || T.untitled}</p>
                    <div style={{ width: 64, height: 1, background: 'var(--c-fg)', opacity: .4, margin: '6px 0 0' }} />

                    {meta.characterName && (
                      <p style={{ margin: '8px 0 0', display: 'flex', alignItems: 'baseline', gap: 8,
                        whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        <span style={{ flexShrink: 0, fontFamily: DISPLAY, fontSize: 9, letterSpacing: '.28em',
                          textTransform: 'uppercase', color: 'var(--c-fg-faint)' }}>{S[cardLang].model}</span>
                        <span style={{ minWidth: 0, fontFamily: TITLE, fontSize: 15, overflow: 'hidden',
                          textOverflow: 'ellipsis' }}>{meta.characterName}</span>
                      </p>
                    )}
                    {(meta.world || meta.job) && (
                      <p style={{ margin: '2px 0 0', fontFamily: DISPLAY, fontSize: 12, color: 'var(--c-fg-dim)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[meta.world, meta.job].filter(Boolean).join('  ·  ')}
                      </p>
                    )}

                    <div style={{ height: 1, background: 'var(--c-rule)', margin: '20px 0' }} />

                    <div ref={listBoxRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                      {worn.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--c-fg-faint)' }}>{T.emptyCard}</p>
                      ) : (
                        <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0,
                          fontSize: `${fit.scale * BASE_PX}px` }}>
                          {worn.map(([id]) => {
                            const { item, dyes } = slots[id];
                            return (
                              <li key={id} style={{ marginBottom: '0.5em' }}>
                                <GearLine item={item} dyes={dyes} lang={cardLang} showSub={subNames}
                                  density={density} dyeStyle={dyeStyle} nameStyle={{ fontWeight: 600 }} />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 }}>
                      <div>
                        <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 13, letterSpacing: '.14em',
                          textTransform: 'uppercase' }}>Final Fantasy XIV</p>
                        <p style={{ margin: '4px 0 0', fontSize: 8.5, lineHeight: 1.5,
                          color: 'var(--c-fg-faint)' }}>
                          FINAL FANTASY XIV © SQUARE ENIX CO., LTD. All Rights Reserved.
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Barcode label={`${meta.title}${meta.characterName}${worn.length}`} />
                        <p style={{ margin: '2px 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 8,
                          letterSpacing: '.18em', color: 'var(--c-fg-faint)' }}>
                          {(cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global) ? `PATCH ${cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global}` : 'GLAMOUR'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Spine text, the way a lookbook prints its title down the edge. */}
                <p style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                  writingMode: 'vertical-rl', margin: 0, fontFamily: DISPLAY, fontSize: 10,
                  letterSpacing: '.42em', textTransform: 'uppercase', color: 'var(--c-fg-faint)' }}>
                  {S[cardLang].collection}
                </p>
              </>
            ) : (
              <>
                <ImageSlot image={image} focus={focus} zoom={zoom} share={LAYOUTS[layout][1]} hint={T.imageSlotHint} style={{ background: 'var(--c-surface-sunken)' }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ margin: '0 28px', padding: '26px 0 16px',
                    borderBottom: '1px solid var(--c-rule-strong)', boxShadow: '0 3px 0 -2px var(--c-rule)' }}>
                    <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 11, letterSpacing: '.28em',
                      textTransform: 'uppercase', fontStyle: 'italic', color: 'var(--c-fg-faint)' }}>{S[cardLang].eyebrow}</p>
                    <h3 style={{ margin: '4px 0 0', fontFamily: TITLE, fontWeight: 500, fontSize: 32, fontWeight: 400,
                      lineHeight: 1.2, wordBreak: 'keep-all', color: meta.title ? 'var(--c-fg)' : 'var(--c-fg-faint)' }}>
                      {meta.title || T.untitled}
                    </h3>
                    {(identity || meta.job) && (
                      <p style={{ margin: '4px 0 0', fontFamily: TITLE, fontSize: 14, color: 'var(--c-fg-dim)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {identity}{identity && meta.job ? ' · ' : ''}{meta.job}
                      </p>
                    )}
                  </div>
                  {worn.length === 0 ? (
                    <p style={{ margin: 0, padding: '8px 28px 0', fontSize: 13, color: 'var(--c-fg-faint)' }}>{T.emptyCard}</p>
                  ) : (
                    <div ref={listBoxRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '8px 28px 0' }}>
                      <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0,
                        fontSize: `${fit.scale * BASE_PX}px` }}>
                        {worn.map(([id]) => {
                          const { item, dyes } = slots[id];
                          return (
                            <li key={id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6em',
                              padding: '0.4em 0', borderTop: `1px solid var(--c-rule-soft)` }}>
                              <Frame size="2.1em" label={SLOT_NAME[cardLang][id].slice(0, 1)} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <GearLine item={item} dyes={dyes} lang={cardLang} showSub={subNames}
                                  density={density} dyeStyle={dyeStyle} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0, padding: '12px 28px',
                    borderTop: `1px solid var(--c-rule)`, fontSize: 12, color: 'var(--c-fg-faint)' }}>
                    <span>{worn.length} {S[cardLang].pieces}{strip.length > 0 ? ` · ${strip.length} ${S[cardLang].colors}` : ''}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {(cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global) && (
                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                          {S[cardLang].patch} {cardLang === 'ko' ? VERSIONS.ko : VERSIONS.global}
                        </span>
                      )}
                      <span style={{ fontFamily: DISPLAY, letterSpacing: '.1em' }}>
                        FINAL FANTASY XIV © SQUARE ENIX
                      </span>
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 22, alignItems: 'start' }}>
        <section>
          <h2 style={{ margin: '0 0 6px', fontFamily: DISPLAY, fontSize: 11, fontWeight: 400,
            letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--c-fg-faint)' }}>{T.equip}</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {UI_SLOTS.map(([id, accepts]) => {
              const st = slots[id];
              const label = SLOT_NAME[uiLang][id];
              return (
                <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', borderTop: `1px solid var(--c-rule-soft)` }}>
                  <button onClick={() => setEditing({ kind: 'item', slot: id, accepts })}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    <Frame size="38px" label={label.slice(0, 1)} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 10, letterSpacing: '.06em', color: 'var(--c-fg-faint)' }}>{label}</span>
                      <span style={{ display: 'block', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis', color: st.item ? 'var(--c-fg)' : 'var(--c-fg-faint)',
                        fontStyle: st.item ? 'normal' : 'italic', fontFamily: SANS }}>
                        {st.item ? name(st.item.name, uiLang) : T.empty}
                      </span>
                    </span>
                  </button>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {st.item && Array.from({ length: st.item.dyeCount }, (_, i) => (
                      <button key={i} onClick={() => setEditing({ kind: 'dye', slot: id, index: i })}
                        aria-label={`${label} ${T.dye} ${i + 1}`} title={`${label} · ${T.dye} ${i + 1}`}
                        style={{ width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
                          background: st.dyes[i] ? st.dyes[i].hex : 'transparent',
                          border: st.dyes[i] ? '1px solid var(--c-swatch-edge)' : `1px dashed var(--c-rule-strong)` }} />
                    ))}
                    {st.item && (
                      <button onClick={() => setItem(id, null)} aria-label="clear"
                        style={{ background: 'transparent', border: 'none', color: 'var(--c-fg-faint)', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 style={{ margin: '0 0 6px', fontFamily: DISPLAY, fontSize: 11, fontWeight: 400,
            letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--c-fg-faint)' }}>{T.details}</h2>

          <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-fg-faint)' }}>{T.image}</p>
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={(e) => { readImage(e.target.files?.[0]); e.target.value = ''; }} />
          {image ? (
            <>
              <div ref={padRef} onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); movePad(e); }}
                onPointerMove={movePad}
                style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 4,
                  overflow: 'hidden', border: `1px solid var(--c-rule)`, cursor: 'grab', touchAction: 'none' }}>
                <img src={image} alt="" draggable={false} style={{ width: '100%', height: '100%',
                  objectFit: 'cover', objectPosition: `${focus.x}% ${focus.y}%`, userSelect: 'none',
                  transform: zoom === 1 ? undefined : `scale(${zoom})`,
                  transformOrigin: `${focus.x}% ${focus.y}%` }} />
                <span style={{ position: 'absolute', left: `${focus.x}%`, top: `${focus.y}%`, width: 18, height: 18,
                  marginLeft: -9, marginTop: -9, borderRadius: '50%', border: `2px solid var(--c-fg)`,
                  boxShadow: '0 0 0 1px var(--c-scrim)', pointerEvents: 'none' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
                fontSize: 11, color: 'var(--c-fg-dim)' }}>
                <span style={{ flexShrink: 0 }}>{T.zoom}</span>
                <input type="range" min="1" max="3" step="0.05" value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ width: 38, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                  {zoom.toFixed(2)}×
                </span>
              </label>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => fileRef.current?.click()}
                  style={{ flex: 1, background: 'transparent', border: `1px solid var(--c-rule)`, borderRadius: 4,
                    color: 'var(--c-fg-dim)', cursor: 'pointer', fontSize: 11, padding: '4px 8px', fontFamily: SANS }}>{T.imageReplace}</button>
                <button onClick={() => setImage(null)}
                  style={{ background: 'transparent', border: `1px solid var(--c-rule)`, borderRadius: 4,
                    color: 'var(--c-fg-dim)', cursor: 'pointer', fontSize: 11, padding: '4px 8px', fontFamily: SANS }}>{T.imageRemove}</button>
              </div>
              <p style={{ margin: '6px 0 12px', fontSize: 10, lineHeight: 1.5, color: 'var(--c-fg-faint)' }}>{T.imageDragHint}</p>
            </>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); readImage(e.dataTransfer.files?.[0]); }}
              style={{ width: '100%', marginBottom: 12, padding: '22px 10px', borderRadius: 4, cursor: 'pointer',
                background: dragOver ? 'var(--c-surface-raised)' : 'transparent', fontFamily: SANS,
                border: `1px dashed ${dragOver ? accent : 'var(--c-rule-strong)'}`, display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--c-fg)' }}>{T.imageAdd}</span>
              <span style={{ display: 'block', fontSize: 10, color: 'var(--c-fg-faint)', marginTop: 3 }}>{T.imageHint}</span>
            </button>
          )}

          <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-fg-faint)' }}>{T.cardStyle}</p>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[['plain', T.plain], ['editorial', T.editorialStyle]].map(([k, l]) =>
              langBtn(k, l, cardStyle === k, () => setCardStyle(k)))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[['masthead', T.mastheadStyle], ['spread', T.spreadStyle]].map(([k, l]) =>
              langBtn(k, l, cardStyle === k, () => setCardStyle(k)))}
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-fg-faint)' }}>{T.dyeStyle}</p>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[['swatch', T.dyeSwatch], ['text', T.dyeText]].map(([k, l]) =>
              langBtn(k, l, dyeStyle === k, () => setDyeStyle(k)))}
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-fg-faint)' }}>{T.layout}</p>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {['square', 'landscape', 'wide'].map((l) => langBtn(l, T[l], layout === l, () => setLayout(l)))}
          </div>

          {field('title', T.title)}
          {field('characterName', T.char)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {field('world', T.world)}
            {field('job', T.job)}
          </div>
          <p style={{ margin: '2px 0 4px', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-fg-faint)' }}>{T.cardTheme}</p>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {['auto', 'light', 'dark'].map((k) => langBtn(k, T[k], cardTheme === k, () => setCardTheme(k)))}
          </div>
          <p style={{ margin: '2px 0 4px', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-fg-faint)' }}>{T.cardLang}</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['auto', T.langAuto], ['ko', '한국어'], ['ja', '日本語'], ['en', 'EN']].map(([l, label]) =>
              langBtn(l, label, cardLangPref === l, () => setCardLangPref(l)))}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 10, lineHeight: 1.5, color: 'var(--c-fg-faint)' }}>{T.hint}</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11,
            color: 'var(--c-fg-dim)', cursor: 'pointer' }}>
            <input type="checkbox" checked={subNames} onChange={(e) => setSubNames(e.target.checked)} />
            {T.subNames}
          </label>
          {confirmingReset ? (
            <div style={{ marginTop: 16, padding: 8, borderRadius: 4, border: `1px solid ${accent}` }}>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'var(--c-fg-dim)' }}>
                {T.resetConfirm}
              </p>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <button onClick={resetAll}
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                    background: 'transparent', border: `1px solid ${accent}`, color: 'var(--c-fg)',
                    fontSize: 11, fontFamily: SANS }}>{T.resetYes}</button>
                <button onClick={() => setConfirmingReset(false)}
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                    background: 'transparent', border: `1px solid var(--c-rule)`, color: 'var(--c-fg-dim)',
                    fontSize: 11, fontFamily: SANS }}>{T.cancel}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmingReset(true)}
              style={{ width: '100%', marginTop: 16, padding: '6px 10px', borderRadius: 4, cursor: 'pointer',
                background: 'transparent', border: `1px solid var(--c-rule)`, color: 'var(--c-fg-dim)',
                fontSize: 11, fontFamily: SANS }}>{T.reset}</button>
          )}
        </section>
        </div>
      </main>

      {editing?.kind === 'item' && (
        <Modal onClose={() => setEditing(null)} label={SLOT_NAME[uiLang][editing.slot]}>
          <div style={{ padding: '10px 16px 8px', borderBottom: `1px solid var(--c-rule)` }}>
            <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 10, letterSpacing: '.2em',
              textTransform: 'uppercase', color: 'var(--c-fg-faint)' }}>{SLOT_NAME[uiLang][editing.slot]}</p>
            <input ref={inputRef} value={query} placeholder={T.search}
              onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(null);
                else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                else if (e.key === 'Enter' && results[cursor]) { setItem(editing.slot, results[cursor]); setEditing(null); }
              }}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, background: 'transparent',
                border: 'none', outline: 'none', color: 'var(--c-fg)', fontSize: 16, fontFamily: SANS }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {results.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--c-fg-dim)' }}>{T.none}</p>
            ) : results.map((item, i) => (
              <button key={item.id} onMouseEnter={() => setCursor(i)}
                onClick={() => { setItem(editing.slot, item); setEditing(null); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px',
                  background: i === cursor ? `var(--c-hover)` : 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: SANS }}>
                <Frame size="30px" label={SLOT_NAME[uiLang][editing.slot].slice(0, 1)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--c-fg)', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>{name(item.name, uiLang)}</span>
                  {uiLang !== 'ko' && item.name.ko && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--c-fg-faint)', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name.ko}</span>
                  )}
                </span>
                {item.dyeCount > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--c-fg-faint)', letterSpacing: '.1em' }}>{'◆'.repeat(item.dyeCount)}</span>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {editing?.kind === 'dye' && (() => {
        const cur = slots[editing.slot].dyes[editing.index];
        const shown = hoverDye || cur;
        return (
          <Modal onClose={() => { setEditing(null); setHoverDye(null); }} label={T.dye}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '10px 16px', borderBottom: `1px solid var(--c-rule)` }}>
              <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 10, letterSpacing: '.2em',
                textTransform: 'uppercase', color: 'var(--c-fg-faint)' }}>
                {SLOT_NAME[uiLang][editing.slot]} · {T.dye} {editing.index + 1}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: shown ? 'var(--c-fg)' : 'var(--c-fg-faint)' }}>
                {shown ? name(shown.name, uiLang) : T.noDye}
                {shown && <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'var(--c-fg-faint)' }}>{shown.hex}</span>}
              </p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }} onMouseLeave={() => setHoverDye(null)}>
              <button onClick={() => { setDye(editing.slot, editing.index, null); setEditing(null); }}
                style={{ width: '100%', marginBottom: 14, padding: '6px 10px', textAlign: 'left', cursor: 'pointer',
                  background: 'transparent', borderRadius: 4, fontSize: 12, fontFamily: SANS,
                  color: cur ? 'var(--c-fg-dim)' : 'var(--c-fg)', border: `1px solid ${cur ? 'var(--c-rule)' : accent}` }}>{T.noDye}</button>
              {dyeGroups.map(([shade, list]) => (
                <div key={shade} style={{ marginBottom: 14 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, letterSpacing: '.08em', color: 'var(--c-fg-faint)' }}>
                    {SHADE[shade]?.[uiLang] || shade}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {list.map((st) => (
                      <button key={st.id} title={name(st.name, uiLang)} aria-label={name(st.name, uiLang)}
                        onMouseEnter={() => setHoverDye(st)} onFocus={() => setHoverDye(st)}
                        onClick={() => { setDye(editing.slot, editing.index, st); setEditing(null); setHoverDye(null); }}
                        style={{ width: 26, height: 26, borderRadius: 3, cursor: 'pointer', background: st.hex,
                          border: cur?.id === st.id ? `2px solid var(--c-fg)` : '1px solid var(--c-swatch-edge)' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
