import * as React from 'react'
import { Moon, Sun, Smartphone, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStoredTheme, setStoredTheme, type ThemeMode } from '@/services/theme'

const MODES: { mode: ThemeMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'light', icon: <Sun className="h-4 w-4" />, label: 'Light' },
  { mode: 'dark', icon: <Moon className="h-4 w-4" />, label: 'Night' },
  { mode: 'black', icon: <Circle className="h-4 w-4" />, label: 'Black' },
  { mode: 'system', icon: <Smartphone className="h-4 w-4" />, label: 'System' },
]

export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = React.useState<ThemeMode>(() => getStoredTheme())

  const cycle = () => {
    const idx = MODES.findIndex((m) => m.mode === mode)
    const next = MODES[(idx + 1) % MODES.length].mode
    setMode(next)
    setStoredTheme(next)
  }

  const current = MODES.find((m) => m.mode === mode)

  return (
    <Button variant="ghost" size="icon" onClick={cycle} title={`Theme: ${current?.label}`}>
      {current?.icon}
    </Button>
  )
}
