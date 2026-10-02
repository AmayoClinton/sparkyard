import { bech32ToBytes } from '@/lib/bech32'

const utf8 = new TextDecoder()

export function lud16ToLnurl(address: string): string | null {
  const trimmed = address.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return null
  const name = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  try {
    return new URL(`/.well-known/lnurlp/${encodeURIComponent(name)}`, `https://${domain}`).toString()
  } catch {
    return null
  }
}

export function lud06ToLnurl(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed.startsWith('lnurl1')) return null
  const bytes = bech32ToBytes(trimmed)
  if (!bytes) return null
  const url = utf8.decode(bytes)
  return /^https?:\/\//i.test(url) ? url : null
}

export function resolveLnurl(profile: { lud16?: string; lud06?: string } | null | undefined): string | null {
  if (!profile) return null
  if (profile.lud16) {
    const from16 = lud16ToLnurl(profile.lud16)
    if (from16) return from16
  }
  if (profile.lud06) return lud06ToLnurl(profile.lud06)
  return null
}

export function satsToMsats(sats: number): number {
  return Math.round(sats * 1000)
}

export function msatsToSats(msats: number): number {
  return Math.floor(msats / 1000)
}