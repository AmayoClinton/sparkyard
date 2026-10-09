import { type UserProfile } from '@/types/nostr'
import { relayPool } from '@/services/nostr'

const PALETTE = [
  '#7C3AED', // violet
  '#2563EB', // blue
  '#059669', // emerald
  '#D97706', // amber
  '#DC2626', // red
  '#0891B2', // cyan
]

export function getAvatarColor(pubkey: string): string {
  const lastByte = parseInt(pubkey.slice(-2), 16)
  return PALETTE[lastByte % PALETTE.length]
}

export function getInitial(name?: string, pubkey?: string): string {
  if (name) return name.charAt(0).toUpperCase()
  if (pubkey) return pubkey.charAt(0).toUpperCase()
  return '?'
}

export function generateAvatarSvg(pubkey: string, displayName?: string): string {
  const color = getAvatarColor(pubkey)
  const initial = getInitial(displayName, pubkey)
  const size = 128

  // Simple geometric identicon: 4x4 grid derived from pubkey hash
  const cells: boolean[] = []
  for (let i = 0; i < 8; i++) {
    const byte = parseInt(pubkey.slice(i * 2, i * 2 + 2), 16)
    cells.push((byte & 0x80) !== 0)
    cells.push((byte & 0x40) !== 0)
    cells.push((byte & 0x20) !== 0)
    cells.push((byte & 0x10) !== 0)
  }

  const cellSize = size / 8
  let rects = ''
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const idx = row * 4 + col
      if (cells[idx]) {
        const x = col * cellSize
        const y = row * cellSize
        // Mirror horizontally for symmetry
        rects += `<rect x='${x}' y='${y}' width='${cellSize}' height='${cellSize}' fill='${color}' opacity='0.35'/>`
        rects += `<rect x='${size - x - cellSize}' y='${y}' width='${cellSize}' height='${cellSize}' fill='${color}' opacity='0.35'/>`
      }
    }
  }

  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'><rect width='100%25' height='100%25' fill='${encodeURIComponent(color)}' opacity='0.15'/>${rects}<text x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-size='56' font-family='system-ui, sans-serif' font-weight='600' fill='%23ffffff'>${initial}</text></svg>`
}

export function parseProfileEvent(event: { content: string }): Partial<UserProfile> {
  try {
    return JSON.parse(event.content)
  } catch {
    return {}
  }
}

export function fetchProfile(pubkey: string, timeoutMs = 5000): Promise<UserProfile> {
  return new Promise((resolve) => {
    let settled = false
    let unsub = () => {}
    const finish = (profile: UserProfile) => {
      if (settled) return
      settled = true
      unsub()
      clearTimeout(timer)
      resolve(profile)
    }
    const timer = setTimeout(() => finish({ pubkey }), timeoutMs)
    unsub = relayPool.subscribe(
      [{ kinds: [0], authors: [pubkey], limit: 1 }],
      (event) => {
        finish({ pubkey, ...parseProfileEvent(event) } as UserProfile)
      },
      () => finish({ pubkey })
    )
  })
}
