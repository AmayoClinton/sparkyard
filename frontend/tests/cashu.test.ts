import { describe, it, expect } from 'vitest'
import {
  assertCuratedMint,
  createCashuToken,
  decodeCashuToken,
  encodeCashuToken,
  isCuratedMint,
  normalizeMint,
  storedBalance,
  sumProofAmounts,
  type CashuToken,
} from '../src/services/cashu'

const mint = 'https://mint.minibits.cash/Bitcoin'

function proof(amount: number) {
  return { amount, id: '00abc', C: '02' + 'a'.repeat(64), secret: 'secret-' + amount }
}

const token: CashuToken = {
  token: [{ mint, proofs: [proof(10), proof(25)] }],
  unit: 'sat',
}

describe('Cashu tokens', () => {
  it('round trips a cashuA token', () => {
    const encoded = encodeCashuToken(token)
    expect(encoded.startsWith('cashuA')).toBe(true)
    expect(decodeCashuToken(encoded)).toEqual(token)
  })

  it('rejects non-https mints', () => {
    const bad = encodeCashuToken({ token: [{ mint: 'http://mint.example.com', proofs: [proof(1)] }], unit: 'sat' })
    expect(() => decodeCashuToken(bad)).toThrow('HTTPS')
  })

  it('rejects tokens with invalid proofs', () => {
    const payload = { token: [{ mint, proofs: [{ amount: 0, id: 'x', C: 'y', secret: 'z' }] }], unit: 'sat' }
    const encoded = 'cashuA' + Buffer.from(JSON.stringify(payload)).toString('base64url')
    expect(() => decodeCashuToken(encoded)).toThrow('invalid proofs')
  })

  it('sums proof amounts', () => {
    expect(sumProofAmounts(token)).toBe(35)
  })

  it('enforces the curated mint allowlist', () => {
    expect(isCuratedMint(mint)).toBe(true)
    expect(isCuratedMint(mint + '/')).toBe(true)
    expect(isCuratedMint('https://evil.example.com')).toBe(false)
    expect(() => assertCuratedMint('https://evil.example.com')).toThrow('curated trust list')
    expect(() => createCashuToken(mint, [proof(1)])).not.toThrow()
  })

  it('normalizes mint URLs', () => {
    expect(normalizeMint('https://mint.example.com///')).toBe('https://mint.example.com')
  })

  it('computes stored balance', () => {
    expect(storedBalance([{ ...proof(10), mint }, { ...proof(5), mint }])).toBe(15)
  })
})