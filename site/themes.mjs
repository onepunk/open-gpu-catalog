// Editor-style color themes. Each theme maps the same set of CSS custom
// properties; vendor identity colors are fixed and defined in styles.css.
export const THEMES = [
  // Dark
  { id: 'tokyo-night', name: 'Tokyo Night', appearance: 'dark', vars: { bg: '#1a1b26', panel: '#16161e', raised: '#1f2335', line: '#292e42', ink: '#c0caf5', muted: '#787c99', faint: '#565f89', accent: '#7aa2f7' } },
  { id: 'catppuccin', name: 'Catppuccin', appearance: 'dark', vars: { bg: '#1e1e2e', panel: '#181825', raised: '#24243a', line: '#313244', ink: '#cdd6f4', muted: '#a6adc8', faint: '#6c7086', accent: '#cba6f7' } },
  { id: 'dracula', name: 'Dracula', appearance: 'dark', vars: { bg: '#282a36', panel: '#21222c', raised: '#2f313f', line: '#44475a', ink: '#f8f8f2', muted: '#8f98b3', faint: '#6272a4', accent: '#bd93f9' } },
  { id: 'nord', name: 'Nord', appearance: 'dark', vars: { bg: '#2e3440', panel: '#272c36', raised: '#3b4252', line: '#434c5e', ink: '#eceff4', muted: '#a3aebf', faint: '#7b88a1', accent: '#88c0d0' } },
  { id: 'gruvbox', name: 'Gruvbox', appearance: 'dark', vars: { bg: '#282828', panel: '#1d2021', raised: '#32302f', line: '#504945', ink: '#ebdbb2', muted: '#bdae93', faint: '#928374', accent: '#fabd2f' } },
  { id: 'one-dark', name: 'One Dark', appearance: 'dark', vars: { bg: '#282c34', panel: '#21252b', raised: '#2c313a', line: '#3e4451', ink: '#abb2bf', muted: '#8b93a2', faint: '#5c6370', accent: '#61afef' } },
  { id: 'solarized-dark', name: 'Solarized', appearance: 'dark', vars: { bg: '#002b36', panel: '#00252e', raised: '#073642', line: '#11505f', ink: '#9fb0af', muted: '#839496', faint: '#586e75', accent: '#268bd2' } },
  { id: 'kanagawa', name: 'Kanagawa', appearance: 'dark', vars: { bg: '#1f1f28', panel: '#16161d', raised: '#2a2a37', line: '#363646', ink: '#dcd7ba', muted: '#a6a08a', faint: '#727169', accent: '#7e9cd8' } },
  { id: 'rose-pine', name: 'Rosé Pine', appearance: 'dark', vars: { bg: '#191724', panel: '#1f1d2e', raised: '#26233a', line: '#403d52', ink: '#e0def4', muted: '#908caa', faint: '#6e6a86', accent: '#c4a7e7' } },
  { id: 'vesper', name: 'Vesper', appearance: 'dark', vars: { bg: '#101010', panel: '#161616', raised: '#1c1c1c', line: '#282828', ink: '#ffffff', muted: '#a0a0a0', faint: '#6b6b6b', accent: '#ffc799' } },
  // Light
  { id: 'one-light', name: 'One Light', appearance: 'light', vars: { bg: '#fafafa', panel: '#f0f0f1', raised: '#ffffff', line: '#dbdbdc', ink: '#383a42', muted: '#696c77', faint: '#a0a1a7', accent: '#4078f2' } },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', appearance: 'light', vars: { bg: '#eff1f5', panel: '#e6e9ef', raised: '#ffffff', line: '#ccd0da', ink: '#4c4f69', muted: '#6c6f85', faint: '#9ca0b0', accent: '#8839ef' } },
  { id: 'tokyo-day', name: 'Tokyo Day', appearance: 'light', vars: { bg: '#e1e2e7', panel: '#d5d7e0', raised: '#eff0f4', line: '#c4c8da', ink: '#343b58', muted: '#6172b0', faint: '#8990b3', accent: '#2e7de9' } },
  { id: 'gruvbox-light', name: 'Gruvbox Light', appearance: 'light', vars: { bg: '#fbf1c7', panel: '#f2e5bc', raised: '#fdf6d8', line: '#d5c4a1', ink: '#3c3836', muted: '#665c54', faint: '#928374', accent: '#af3a03' } },
  { id: 'solarized-light', name: 'Solarized Light', appearance: 'light', vars: { bg: '#fdf6e3', panel: '#eee8d5', raised: '#fffcf0', line: '#d9d2c2', ink: '#586e75', muted: '#657b83', faint: '#93a1a1', accent: '#268bd2' } },
  { id: 'kanagawa-lotus', name: 'Kanagawa Lotus', appearance: 'light', vars: { bg: '#f2ecbc', panel: '#e5ddb0', raised: '#faf5d8', line: '#d5cea3', ink: '#545464', muted: '#716e61', faint: '#8a8980', accent: '#4d699b' } },
  { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn', appearance: 'light', vars: { bg: '#faf4ed', panel: '#fffaf3', raised: '#f2e9e1', line: '#dfdad9', ink: '#575279', muted: '#797593', faint: '#9893a5', accent: '#907aa9' } },
]

const STORAGE_KEY = 'open-gpu-db-theme'
const STORAGE_VARS_KEY = 'open-gpu-db-theme-vars'

export function defaultThemeId() {
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
  return prefersLight ? 'one-light' : 'tokyo-night'
}

export function storedThemeId() {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY)
    return THEMES.some(theme => theme.id === id) ? id : null
  } catch {
    return null
  }
}

export function applyTheme(id, { persist = false } = {}) {
  const theme = THEMES.find(candidate => candidate.id === id)
  if (!theme) return null

  const root = document.documentElement
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(`--${name}`, value)
  }
  root.style.setProperty('color-scheme', theme.appearance)
  root.dataset.theme = theme.id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars.panel)

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme.id)
      // Snapshot the variables so the inline head script can restore them
      // before this module loads, avoiding a flash of the default theme.
      window.localStorage.setItem(STORAGE_VARS_KEY, JSON.stringify({
        appearance: theme.appearance,
        vars: theme.vars,
      }))
    } catch {
      // Storage may be unavailable; the theme still applies for this visit.
    }
  }
  return theme
}
