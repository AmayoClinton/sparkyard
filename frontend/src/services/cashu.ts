export const CURATED_MINTS = [
  'https://mint.minibits.cash/Bitcoin',
  'https://nut.minibits.cash/Bitcoin',
  'https://mint.coinos.io',
  'https://21mint.me',
  'https://mint.macadamia.cash',
]

export interface CashuProof {
  amount: number
  id: string
  C: string
  secret: string
  witness?: string
}

export interface CashuTokenEntry {
  mint: string
  proofs: CashuProof[]
}

export interface CashuToken {
  token: CashuTokenEntry[]
  unit: string
  memo?: string
}

export interface StoredProof extends CashuProof {
  mint: string
}

const STORAGE_KEY = 'sparkyard.cashu.proofs'

export function normalizeMint(mint: string): string {
  return mint.trim().replace(/\/+$/, '')
}

export function isCuratedMint(mint: string, allowed: string[] = CURATED_MINTS): boolean {
  const target = normalizeMint(mint)
  return allowed.some((entry) => normalizeMint(entry) === target)
}

export function assertCuratedMint(mint: string, allowed: string[] = CURATED_MINTS): void {
  if (!isCuratedMint(mint, allowed)) {
    throw new Error('Mint is not in the curated trust list')
  }
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function isProof(value: unknown): value is CashuProof {
  if (!value || typeof value !== 'object') return false
  const proof = value as Record<string, unknown>
  return (
    typeof proof.amount === 'number' &&
    Number.isInteger(proof.amount) &&
    proof.amount > 0 &&
    typeof proof.id === 'string' &&
    typeof proof.C === 'string' &&
    typeof proof.secret === 'string'
  )
}

export function decodeCashuToken(token: string): CashuToken {
  const trimmed = token.trim()
  let parsed: unknown
  if (trimmed.startsWith('cashuA')) {
    parsed = JSON.parse(base64UrlDecode(trimmed.slice(6)))
  } else if (trimmed.startsWith('cashuB')) {
    parsed = JSON.parse(atob(trimmed.slice(6)))
  } else {
    throw new Error('Invalid Cashu token')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid Cashu token')
  const data = parsed as { token?: unknown; unit?: unknown }
  if (!Array.isArray(data.token) || data.token.length === 0) throw new Error('Cashu token has no proofs')
  const entries: CashuTokenEntry[] = []
  for (const entry of data.token) {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid Cashu token entry')
    const item = entry as { mint?: unknown; proofs?: unknown }
    if (typeof item.mint !== 'string' || !/^https:\/\//i.test(item.mint)) {
      throw new Error('Cashu mint must use HTTPS')
    }
    if (!Array.isArray(item.proofs) || item.proofs.length === 0) throw new Error('Cashu token has no proofs')
    if (!item.proofs.every(isProof)) throw new Error('Cashu token has invalid proofs')
    entries.push({ mint: normalizeMint(item.mint), proofs: item.proofs })
  }
  return { token: entries, unit: typeof data.unit === 'string' ? data.unit : 'sat' }
}

export function encodeCashuToken(token: CashuToken): string {
  return 'cashuA' + base64UrlEncode(JSON.stringify(token))
}

export function createCashuToken(
  mint: string,
  proofs: CashuProof[],
  unit = 'sat',
  memo?: string
): CashuToken {
  assertCuratedMint(mint)
  return { token: [{ mint: normalizeMint(mint), proofs }], unit, memo }
}

export function sumProofAmounts(token: CashuToken): number {
  return token.token.reduce(
    (total, entry) => total + entry.proofs.reduce((sum, proof) => sum + proof.amount, 0),
    0
  )
}

export function loadStoredProofs(): StoredProof[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((proof): proof is StoredProof => isProof(proof) && typeof (proof as StoredProof).mint === 'string')
  } catch {
    return []
  }
}

export function storeProofs(proofs: StoredProof[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs))
}

export function addStoredProofs(entries: CashuTokenEntry[]): StoredProof[] {
  const existing = loadStoredProofs()
  const additions: StoredProof[] = entries.flatMap((entry) =>
    entry.proofs.map((proof) => ({ ...proof, mint: entry.mint }))
  )
  const merged = [...existing, ...additions]
  storeProofs(merged)
  return merged
}

export function storedBalance(proofs: StoredProof[]): number {
  return proofs.reduce((total, proof) => total + proof.amount, 0)
}

export async function getMintInfo(mint: string): Promise<Record<string, unknown>> {
  const url = `${normalizeMint(mint)}/v1/info`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Mint info failed: ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

export function formatSats(amount: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(amount)))
}