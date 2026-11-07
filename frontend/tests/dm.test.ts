import { describe, it, expect, vi, beforeEach } from 'vitest'
import { finalizeEvent, generateSecretKey, getPublicKey, nip44 } from 'nostr-tools'
import { type NostrEvent } from '../src/types/nostr'

const state = vi.hoisted(() => ({ signer: null as unknown }))
const publish = vi.hoisted(() => vi.fn().mockResolvedValue([]))

vi.mock('@/services/auth', () => ({ getSigner: () => state.signer }))
vi.mock('@/services/nostr', () => ({ relayPool: { publish } }))

import {
  buildGiftWrap,
  buildSeal,
  decryptGiftWrap,
  KIND_GIFT_WRAP,
  KIND_RUMOR,
  KIND_SEAL,
  sendDirectMessage,
} from '../src/services/dm'

function makeSigner(secret: Uint8Array) {
  const pubkey = getPublicKey(secret)
  return {
    getPublicKey: async () => pubkey,
    signEvent: async (event: NostrEvent) => finalizeEvent(event, secret) as unknown as NostrEvent,
    nip44Encrypt: async (text: string, peer: string) =>
      nip44.encrypt(text, nip44.getConversationKey(secret, peer)),
    nip44Decrypt: async (text: string, peer: string) =>
      nip44.decrypt(text, nip44.getConversationKey(secret, peer)),
  }
}

const senderSecret = generateSecretKey()
const recipientSecret = generateSecretKey()
const sender = makeSigner(senderSecret)
const recipient = makeSigner(recipientSecret)
const recipientPubkey = getPublicKey(recipientSecret)
const senderPubkey = getPublicKey(senderSecret)

beforeEach(() => {
  publish.mockClear()
  state.signer = sender
})

describe('NIP-17 direct messages', () => {
  it('sends a gift wrap and returns a local message', async () => {
    const message = await sendDirectMessage(recipientPubkey, 'hello there')
    expect(message.content).toBe('hello there')
    expect(message.recipient).toBe(recipientPubkey)
    expect(message.sender).toBe(senderPubkey)
    expect(publish).toHaveBeenCalledOnce()

    const giftWrap = publish.mock.calls[0][0] as NostrEvent
    expect(giftWrap.kind).toBe(KIND_GIFT_WRAP)
    expect(giftWrap.tags).toContainEqual(['p', recipientPubkey])
    expect(giftWrap.tags.some((tag) => tag[0] === 'expiration')).toBe(true)
  })

  it('round trips seal and rumor through gift wrap', async () => {
    await sendDirectMessage(recipientPubkey, 'secret payload')
    const giftWrap = publish.mock.calls[0][0] as NostrEvent
    const decrypted = await decryptGiftWrap(giftWrap, recipient)
    expect(decrypted.content).toBe('secret payload')
    expect(decrypted.sender).toBe(senderPubkey)
    expect(decrypted.recipient).toBe(recipientPubkey)
  })

  it('uses kind 13 seals and kind 14 rumors', async () => {
    const rumor: NostrEvent = {
      kind: KIND_RUMOR,
      pubkey: senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: 'rumor body',
      id: '',
      sig: '',
    }
    const seal = await buildSeal(recipientPubkey, rumor, sender)
    expect(seal.kind).toBe(KIND_SEAL)

    const sealRumor = JSON.parse(await recipient.nip44Decrypt!(seal.content, seal.pubkey)) as NostrEvent
    expect(sealRumor.kind).toBe(KIND_RUMOR)
    expect(sealRumor.content).toBe('rumor body')

    const giftWrap = buildGiftWrap(recipientPubkey, seal)
    expect(giftWrap.kind).toBe(KIND_GIFT_WRAP)
    const unwrapped = JSON.parse(
      await recipient.nip44Decrypt!(giftWrap.content, giftWrap.pubkey)
    ) as NostrEvent
    expect(unwrapped.kind).toBe(KIND_SEAL)
  })

  it('rejects signers without NIP-44 support', async () => {
    state.signer = {
      getPublicKey: async () => senderPubkey,
      signEvent: async (event: NostrEvent) => event,
    }
    await expect(sendDirectMessage(recipientPubkey, 'nope')).rejects.toThrow('NIP-44')
  })

  it('rejects empty messages', async () => {
    await expect(sendDirectMessage(recipientPubkey, '   ')).rejects.toThrow('empty')
  })

  it('fails to decrypt with the wrong key', async () => {
    await sendDirectMessage(recipientPubkey, 'for recipient')
    const giftWrap = publish.mock.calls[0][0] as NostrEvent
    const wrong = makeSigner(generateSecretKey())
    await expect(decryptGiftWrap(giftWrap, wrong)).rejects.toBeTruthy()
  })
})