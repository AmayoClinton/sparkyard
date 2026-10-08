import { finalizeEvent, generateSecretKey, getEventHash, nip44 } from 'nostr-tools'
import { relayPool } from '@/services/nostr'
import { getSigner, type Signer } from '@/services/auth'
import { type NostrEvent } from '@/types/nostr'

export const KIND_RUMOR = 14
export const KIND_SEAL = 13
export const KIND_GIFT_WRAP = 1059
const DM_TTL_SECONDS = 60 * 60 * 24 * 30

export interface DirectMessage {
  id: string
  sender: string
  recipient: string
  content: string
  createdAt: number
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function requireEncrypt(signer: Signer): (plaintext: string, pubkey: string) => Promise<string> {
  if (!signer.nip44Encrypt) {
    throw new Error('Your signer does not support NIP-44. DMs require NIP-17 + NIP-44.')
  }
  return (plaintext, pubkey) => signer.nip44Encrypt!(plaintext, pubkey)
}

function requireDecrypt(signer: Signer): (ciphertext: string, pubkey: string) => Promise<string> {
  if (!signer.nip44Decrypt) {
    throw new Error('Your signer does not support NIP-44. DMs require NIP-17 + NIP-44.')
  }
  return (ciphertext, pubkey) => signer.nip44Decrypt!(ciphertext, pubkey)
}

export async function buildSeal(
  recipient: string,
  rumor: NostrEvent,
  signer: Signer
): Promise<NostrEvent> {
  const encrypt = requireEncrypt(signer)
  const content = await encrypt(JSON.stringify(rumor), recipient)
  const template: NostrEvent = {
    kind: KIND_SEAL,
    pubkey: await signer.getPublicKey(),
    created_at: now(),
    tags: [['p', recipient]],
    content,
    id: '',
    sig: '',
  }
  template.id = getEventHash(template)
  return signer.signEvent(template)
}

export function buildGiftWrap(recipient: string, seal: NostrEvent): NostrEvent {
  const ephemeral = generateSecretKey()
  const conversationKey = nip44.getConversationKey(ephemeral, recipient)
  const content = nip44.encrypt(JSON.stringify(seal), conversationKey)
  const expiresAt = now() + DM_TTL_SECONDS
  return finalizeEvent(
    {
      kind: KIND_GIFT_WRAP,
      created_at: now(),
      tags: [
        ['p', recipient],
        ['expiration', String(expiresAt)],
      ],
      content,
    },
    ephemeral
  ) as unknown as NostrEvent
}

export async function sendDirectMessage(recipient: string, content: string): Promise<DirectMessage> {
  if (!/^[0-9a-f]{64}$/i.test(recipient)) throw new Error('Invalid recipient pubkey')
  const signer = getSigner()
  if (!signer) throw new Error('Sign in to send a DM')
  const text = content.trim()
  if (!text) throw new Error('Message is empty')

  const sender = await signer.getPublicKey()
  const rumor: NostrEvent = {
    kind: KIND_RUMOR,
    pubkey: sender,
    created_at: now(),
    tags: [['p', recipient]],
    content: text,
    id: '',
    sig: '',
  }

  const seal = await buildSeal(recipient, rumor, signer)
  const giftWrap = buildGiftWrap(recipient, seal)
  await relayPool.publish(giftWrap)

  return {
    id: giftWrap.id,
    sender,
    recipient,
    content: text,
    createdAt: rumor.created_at,
  }
}

export async function decryptGiftWrap(
  giftWrap: NostrEvent,
  signer: Signer
): Promise<DirectMessage> {
  const decrypt = requireDecrypt(signer)
  const seal = JSON.parse(await decrypt(giftWrap.content, giftWrap.pubkey)) as NostrEvent
  if (seal.kind !== KIND_SEAL) throw new Error('Invalid seal event')

  const rumor = JSON.parse(await decrypt(seal.content, seal.pubkey)) as NostrEvent
  if (rumor.kind !== KIND_RUMOR) throw new Error('Invalid rumor event')

  return {
    id: giftWrap.id,
    sender: seal.pubkey,
    recipient: rumor.tags.find((tag) => tag[0] === 'p')?.[1] ?? '',
    content: rumor.content,
    createdAt: rumor.created_at,
  }
}

export function subscribeDirectMessages(
  myPubkey: string,
  onMessage: (message: DirectMessage) => void
): () => void {
  return relayPool.subscribe([{ kinds: [KIND_GIFT_WRAP], '#p': [myPubkey], limit: 100 }], (event: NostrEvent) => {
    const signer = getSigner()
    if (!signer) return
    decryptGiftWrap(event, signer)
      .then((message) => {
        if (message.recipient === myPubkey) onMessage(message)
      })
      .catch(() => {})
  })
}