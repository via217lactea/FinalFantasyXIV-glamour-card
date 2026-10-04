import { useEffect } from 'react';

export type Theme = 'dark' | 'light';
/** 'auto' means the card follows the interface. */
export type CardTheme = Theme | 'auto';

const KEY = 'glamour-card:theme';

export function initialTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  // Parchment is the intended default; only an explicit dark preference flips it.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(theme: Theme) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);
}

export function resolveCardTheme(card: CardTheme, ui: Theme): Theme {
  return card === 'auto' ? ui : card;
}
