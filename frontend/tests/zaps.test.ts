import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { publish, getConnectedRelays, signer } = vi.hoisted(() => {
  const recipient = 'a'.repeat(64)
  return {
    publish: vi.fn().mockResolvedValue([]),
    getConnectedRelays: vi.fn().mockReturnValue([]),
    signer: {
      getPublicKey: vi.fn().mockResolvedValue(recipient),
      signEvent: vi.fn().mockImplementation(async (event: Record<string, unknown>) => ({
        ...event,
        id: 'signed-id',
        sig: 'signed-sig',
      })),
    },
  }
})

vi.mock('@/services/nostr', () => ({
  relayPool: { publish, getConnectedRelays },
  DEFAULT_RELAYS: [{ url: 'wss://relay.damus.io', read: true, write: true }],
}))

vi.mock('@/services/auth', () => ({ getSigner: () => signer }))

import { fetchLnurlPay, prepareZap, publishZapReceipt, requestInvoice } from '../src/services/zaps'
import { type NostrEvent } from '../src/types/nostr'

const recipient = 'a'.repeat(64)

const payData = {
  callback: 'https://pay.example/invoice',
  minSendable: 1000,
  maxSendable: 100000000,
  metadata: '[]',
  tag: 'payRequest',
  allowsNostr: true,
  nostrPubkey: 'b'.repeat(64),
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  publish.mockClear()
  getConnectedRelays.mockReturnValue([])
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payData)))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('zap helpers', () => {
  it('fetches and validates LNURL-pay metadata', async () => {
    const pay = await fetchLnurlPay('https://pay.example/.well-known/lnurlp/alice')
    expect(pay.callback).toBe(payData.callback)
    expect(pay.allowsNostr).toBe(true)
  })

  it('rejects non payRequest endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tag: 'withdrawRequest' })))
    await expect(fetchLnurlPay('https://pay.example/lnurl')).rejects.toThrow('Not a LNURL-pay endpoint')
  })

  it('requests an invoice with amount and zap request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ pr: 'lnbc1invoice' }))
    vi.stubGlobal('fetch', fetchMock)
    const invoice = await requestInvoice(payData, 21000, '{"kind":9734}')
    expect(invoice.pr).toBe('lnbc1invoice')
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('amount')).toBe('21000')
    expect(url.searchParams.get('nostr')).toBe('{"kind":9734}')
  })

  it('prepares a signed kind 9734 zap request', async () => {
    const plan = await prepareZap(
      { recipient, profile: { lud16: 'alice@example.com' } },
      21,
      'nice post'
    )
    expect(plan.amountMsats).toBe(21000)
    expect(plan.zapRequest.kind).toBe(9734)
    expect(plan.zapRequest.tags).toContainEqual(['p', recipient])
    expect(plan.zapRequest.tags).toContainEqual(['amount', '21000'])
    expect(plan.zapRequest.sig).toBe('signed-sig')
  })

  it('rejects amounts outside the LNURL-pay range', async () => {
    await expect(
      prepareZap({ recipient, profile: { lud16: 'alice@example.com' } }, 0.5)
    ).rejects.toThrow('Minimum zap')
  })

  it('publishes a signed kind 9735 receipt', async () => {
    const zapRequestJson = JSON.stringify({
      kind: 9734,
      pubkey: recipient,
      created_at: 1,
      tags: [['p', recipient], ['amount', '21000'], ['relays', 'wss://relay.damus.io']],
      content: '',
      id: 'x',
      sig: 'y',
    })
    const receipt = await publishZapReceipt(zapRequestJson, 'lnbc1invoice', 'preimage')
    expect(receipt.kind).toBe(9735)
    expect(receipt.tags).toContainEqual(['bolt11', 'lnbc1invoice'])
    expect(receipt.tags).toContainEqual(['preimage', 'preimage'])
    expect(publish).toHaveBeenCalledOnce()
  })

  it('prepares event zaps with e and k tags', async () => {
    const note = {
      id: 'note-id',
      pubkey: recipient,
      created_at: 1,
      kind: 1,
      tags: [],
      content: 'hello',
      sig: '',
    } as NostrEvent
    const plan = await prepareZap({ recipient, profile: { lud16: 'alice@example.com' }, note }, 10)
    expect(plan.zapRequest.tags).toContainEqual(['e', 'note-id'])
    expect(plan.zapRequest.tags).toContainEqual(['k', '1'])
  })
})