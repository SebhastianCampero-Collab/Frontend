import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'devguardian.theme';

export function readTheme(): Theme {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0C0F16' : '#F9F9F9');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== localStorage) return;
      if (event.key === THEME_KEY || event.key === null) setTheme(event.newValue === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const selectTheme = (next: Theme) => {
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* The theme still works when storage is unavailable. */ }
  };
  return { theme, selectTheme };
}
