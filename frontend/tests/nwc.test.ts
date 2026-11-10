import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSecretKey, getPublicKey, nip04, nip44 } from 'nostr-tools'

const { subscribe, publish, addRelay } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  publish: vi.fn().mockResolvedValue([]),
  addRelay: vi.fn(),
}))

vi.mock('@/services/nostr', () => ({
  relayPool: { subscribe, publish, addRelay },
}))

import {
  decryptNwcResponse,
  encryptNwcRequest,
  nwcGetBalance,
  nwcPayInvoice,
  parseNwcUri,
  type NwcSession,
} from '../src/services/nwc'

const walletSecret = generateSecretKey()
const walletPubkey = getPublicKey(walletSecret)
const clientSecret = generateSecretKey()
const clientPubkey = getPublicKey(clientSecret)
const relay = 'wss://relay.example.com'
const secret = Buffer.from(clientSecret).toString('hex')

function session(): NwcSession {
  return { walletPubkey, relays: [relay], clientPubkey, secretKey: clientSecret }
}

function encryptedResponse(payload: unknown): string {
  const conversationKey = nip44.getConversationKey(clientSecret, walletPubkey)
  return nip44.encrypt(JSON.stringify(payload), conversationKey)
}

beforeEach(() => {
  subscribe.mockReset()
  publish.mockClear()
  addRelay.mockClear()
})

describe('NWC connection string', () => {
  it('parses a full connection string', () => {
    const parsed = parseNwcUri(`nostr+walletconnect://${walletPubkey}?relay=${encodeURIComponent(relay)}&secret=${secret}`)
    expect(parsed.walletPubkey).toBe(walletPubkey)
    expect(parsed.relays).toEqual([relay])
    expect(parsed.secret).toBe(secret)
  })

  it('allows a missing secret', () => {
    const parsed = parseNwcUri(`nostr+walletconnect://${walletPubkey}?relay=${encodeURIComponent(relay)}`)
    expect(parsed.secret).toBeUndefined()
  })

  it('rejects invalid connection strings', () => {
    expect(() => parseNwcUri('https://example.com')).toThrow('Invalid NWC connection string')
    expect(() => parseNwcUri(`nostr+walletconnect://${walletPubkey}`)).toThrow('needs a relay')
    expect(() => parseNwcUri('nostr+walletconnect://nope?relay=wss://x')).toThrow('wallet pubkey is invalid')
  })
})

describe('NWC encryption', () => {
  it('round trips NIP-44 request payloads', () => {
    const encrypted = encryptNwcRequest(clientSecret, walletPubkey, 'get_balance', {})
    const decrypted = decryptNwcResponse(clientSecret, walletPubkey, encrypted)
    expect(decrypted.method).toBe('get_balance')
  })

  it('falls back to NIP-04 for legacy wallets', () => {
    const legacy = nip04.encrypt(clientSecret, walletPubkey, JSON.stringify({ result_type: 'get_info' }))
    const decrypted = decryptNwcResponse(clientSecret, walletPubkey, legacy)
    expect(decrypted.result_type).toBe('get_info')
  })
})

describe('NWC requests', () => {
  it('returns a wallet balance in msats', async () => {
    subscribe.mockImplementation((_filters, onEvent: (event: unknown) => void) => {
      onEvent({
        id: 'resp',
        pubkey: walletPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 23195,
        tags: [['p', clientPubkey]],
        content: encryptedResponse({ result_type: 'get_balance', balance: 42000 }),
        sig: '',
      })
      return () => {}
    })
    const balance = await nwcGetBalance(session())
    expect(balance).toBe(42000)
    expect(publish).toHaveBeenCalledOnce()
  })

  it('returns a payment preimage', async () => {
    subscribe.mockImplementation((_filters, onEvent: (event: unknown) => void) => {
      onEvent({
        id: 'resp',
        pubkey: walletPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 23195,
        tags: [['p', clientPubkey]],
        content: encryptedResponse({ result_type: 'pay_invoice', preimage: 'abc123' }),
        sig: '',
      })
      return () => {}
    })
    const preimage = await nwcPayInvoice(session(), 'lnbc1invoice')
    expect(preimage).toBe('abc123')
  })

  it('surfaces wallet errors', async () => {
    subscribe.mockImplementation((_filters, onEvent: (event: unknown) => void) => {
      onEvent({
        id: 'resp',
        pubkey: walletPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 23195,
        tags: [['p', clientPubkey]],
        content: encryptedResponse({ error: { code: 'RATE_LIMITED', message: 'slow down' } }),
        sig: '',
      })
      return () => {}
    })
    await expect(nwcGetBalance(session())).rejects.toThrow('slow down')
  })
})