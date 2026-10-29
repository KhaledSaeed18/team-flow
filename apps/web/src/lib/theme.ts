import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'teamflow:theme';
const listeners = new Set<() => void>();

const current = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(KEY, theme);
  for (const listener of listeners) listener();
}

export function useTheme(): Theme {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, current);
}
