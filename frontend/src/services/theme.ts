import type { ThemeMode } from '@/types/nostr'
export type { ThemeMode }

const STORAGE_KEY = 'sparkyard-theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' | 'black' {
  if (mode === 'system') return getSystemTheme()
  return mode
}

export function getStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'black' || raw === 'system') return raw
  } catch { /* storage blocked */ }
  return 'dark'
}

export function setStoredTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch { /* storage blocked */ }
  applyTheme(mode)
}

export function applyTheme(mode: ThemeMode): void {
  const resolved = getResolvedTheme(mode)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function initTheme(): void {
  const mode = getStoredTheme()
  applyTheme(mode)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = getStoredTheme()
    if (current === 'system') applyTheme('system')
  })
}
