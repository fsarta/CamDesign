// ─── Theme System for MOTUS NOVA ─────────────────────────────

export type Theme = 'dark' | 'light';

/** Apply CSS variables based on theme */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: '🌙' },
  { value: 'light', label: '☀️' },
];
