export type EditorSyntaxTheme = 'default' | 'ocean' | 'emerald' | 'neonwave'

export interface SyntaxColors {
  string: string
  number: string
  boolean: string
  null: string
  key: string
}

interface ThemeDef {
  label: string
  dark: SyntaxColors
  light: SyntaxColors
}

export const EDITOR_THEMES: Record<EditorSyntaxTheme, ThemeDef> = {
  default: {
    label: 'Default',
    dark:  { string: '#86efac', number: '#93c5fd', boolean: '#fca5a5', null: '#9ca3af', key: '#3b9eff' },
    light: { string: '#16a34a', number: '#1d4ed8', boolean: '#dc2626', null: '#9ca3af', key: '#0070f3' },
  },
  ocean: {
    label: 'Ocean',
    dark:  { string: '#67e8f9', number: '#a78bfa', boolean: '#38bdf8', null: '#4b6b8a', key: '#60a5fa' },
    light: { string: '#0891b2', number: '#7c3aed', boolean: '#0284c7', null: '#94a3b8', key: '#2563eb' },
  },
  emerald: {
    label: 'Emerald',
    dark:  { string: '#6ee7b7', number: '#fcd34d', boolean: '#fb923c', null: '#78716c', key: '#34d399' },
    light: { string: '#059669', number: '#b45309', boolean: '#ea580c', null: '#78716c', key: '#047857' },
  },
  neonwave: {
    label: 'Neonwave',
    dark:  { string: '#f472b6', number: '#22d3ee', boolean: '#a78bfa', null: '#4b5563', key: '#e879f9' },
    light: { string: '#db2777', number: '#0891b2', boolean: '#7c3aed', null: '#94a3b8', key: '#c026d3' },
  },
}

export const EDITOR_THEME_ORDER: EditorSyntaxTheme[] = ['default', 'ocean', 'emerald', 'neonwave']
