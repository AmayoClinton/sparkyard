import { describe, it, expect } from 'vitest'
import { lud06ToLnurl, lud16ToLnurl, msatsToSats, resolveLnurl, satsToMsats } from '../src/lib/lightning'

const LNURL = 'lnurl1dp68gurn8ghj7etcv9khqmr99e3k7mf0d3h82unv9acxz7gk6wc8d'

describe('lightning address helpers', () => {
  it('converts lud16 to an LNURL-pay endpoint', () => {
    expect(lud16ToLnurl('alice@example.com')).toBe('https://example.com/.well-known/lnurlp/alice')
  })

  it('rejects malformed lud16 addresses', () => {
    expect(lud16ToLnurl('not-an-address')).toBeNull()
    expect(lud16ToLnurl('@example.com')).toBeNull()
    expect(lud16ToLnurl('alice@')).toBeNull()
  })

  it('decodes a bech32 lud06 into an https URL', () => {
    expect(lud06ToLnurl(LNURL)).toBe('https://example.com/lnurl/pay')
  })

  it('rejects invalid lud06 values', () => {
    expect(lud06ToLnurl('lnurl1invalid')).toBeNull()
    expect(lud06ToLnurl('https://example.com')).toBeNull()
  })

  it('prefers lud16 over lud06 when resolving', () => {
    expect(resolveLnurl({ lud16: 'bob@pay.example', lud06: LNURL })).toBe(
      'https://pay.example/.well-known/lnurlp/bob'
    )
    expect(resolveLnurl({ lud06: LNURL })).toBe('https://example.com/lnurl/pay')
    expect(resolveLnurl(null)).toBeNull()
  })

  it('converts between sats and msats', () => {
    expect(satsToMsats(21)).toBe(21000)
    expect(msatsToSats(21000)).toBe(21)
  })
})