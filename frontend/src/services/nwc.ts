import { finalizeEvent, generateSecretKey, getPublicKey, nip04, nip44 } from 'nostr-tools'
import { relayPool } from '@/services/nostr'
import { type NostrEvent } from '@/types/nostr'
import { deleteSecret, loadSecret, saveSecret } from '@/services/secret-store'

const HEX_64 = /^[0-9a-f]{64}$/i

export interface NwcConnection {
  walletPubkey: string
  relays: string[]
  secret?: string
}

export interface NwcSession {
  walletPubkey: string
  relays: string[]
  clientPubkey: string
  secretKey: Uint8Array
}

export interface NwcResponse {
  result_type?: string
  error?: { code: string; message: string }
  [key: string]: unknown
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function parseNwcUri(uri: string): NwcConnection {
  const trimmed = uri.trim()
  if (!trimmed.startsWith('nostr+walletconnect://')) {
    throw new Error('Invalid NWC connection string')
  }
  const parsed = new URL(trimmed)
  const walletPubkey = parsed.hostname
  if (!HEX_64.test(walletPubkey)) throw new Error('NWC wallet pubkey is invalid')
  const relays = parsed.searchParams.getAll('relay').filter((r) => r.startsWith('wss://') || r.startsWith('ws://'))
  if (relays.length === 0) throw new Error('NWC connection string needs a relay')
  const secret = parsed.searchParams.get('secret') ?? undefined
  if (secret && !HEX_64.test(secret)) throw new Error('NWC secret is invalid')
  return { walletPubkey, relays, secret }
}

export function encryptNwcRequest(
  secretKey: Uint8Array,
  walletPubkey: string,
  method: string,
  params: Record<string, unknown>
): string {
  const conversationKey = nip44.getConversationKey(secretKey, walletPubkey)
  return nip44.encrypt(JSON.stringify({ method, params }), conversationKey)
}

export function decryptNwcResponse(
  secretKey: Uint8Array,
  walletPubkey: string,
  content: string
): NwcResponse {
  const conversationKey = nip44.getConversationKey(secretKey, walletPubkey)
  try {
    return JSON.parse(nip44.decrypt(content, conversationKey)) as NwcResponse
  } catch {
    return JSON.parse(nip04.decrypt(secretKey, walletPubkey, content)) as NwcResponse
  }
}

export async function connectNwc(uri: string): Promise<NwcSession> {
  const connection = parseNwcUri(uri)
  const secretKey = connection.secret ? hexToBytes(connection.secret) : generateSecretKey()
  await saveSecret('nwc-secret', bytesToHex(secretKey))
  const clientPubkey = getPublicKey(secretKey)
  const session: NwcSession = {
    walletPubkey: connection.walletPubkey,
    relays: connection.relays,
    clientPubkey,
    secretKey,
  }
  await saveSecret(
    'nwc-session',
    JSON.stringify({
      walletPubkey: connection.walletPubkey,
      relays: connection.relays,
      clientPubkey,
    })
  )
  for (const relay of connection.relays) relayPool.addRelay(relay)
  return session
}

export async function loadNwcSession(): Promise<NwcSession | null> {
  const raw = await loadSecret('nwc-session')
  const secret = await loadSecret('nwc-secret')
  if (!raw || !secret || !HEX_64.test(secret)) return null
  const data = JSON.parse(raw) as { walletPubkey: string; relays: string[]; clientPubkey: string }
  return { ...data, secretKey: hexToBytes(secret) }
}

export function clearNwcSession(): void {
  deleteSecret('nwc-session')
  deleteSecret('nwc-secret')
}

export async function nwcRequest(
  session: NwcSession,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 20000
): Promise<NwcResponse> {
  const content = encryptNwcRequest(session.secretKey, session.walletPubkey, method, params)
  const event = finalizeEvent(
    {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags: [['p', session.walletPubkey]],
    },
    session.secretKey
  ) as unknown as NostrEvent

  return new Promise<NwcResponse>((resolve, reject) => {
    const state: { unsub: () => void; timer?: ReturnType<typeof setTimeout> } = { unsub: () => {} }
    const cleanup = () => {
      if (state.timer) clearTimeout(state.timer)
      state.unsub()
    }
    const since = Math.floor(Date.now() / 1000) - 5
    state.unsub = relayPool.subscribe(
      [{ kinds: [23195], authors: [session.walletPubkey], '#p': [session.clientPubkey], since }],
      (response: NostrEvent) => {
        if (response.pubkey !== session.walletPubkey) return
        let parsed: NwcResponse
        try {
          parsed = decryptNwcResponse(session.secretKey, session.walletPubkey, response.content)
        } catch {
          return
        }
        if (parsed.error) {
          cleanup()
          reject(new Error(parsed.error.message))
          return
        }
        if (parsed.result_type && parsed.result_type !== method) return
        cleanup()
        resolve(parsed)
      }
    )
    state.timer = setTimeout(() => {
      cleanup()
      reject(new Error('NWC request timed out'))
    }, timeoutMs)
    void relayPool.publish(event)
  })
}

export async function nwcGetBalance(session: NwcSession): Promise<number> {
  const response = await nwcRequest(session, 'get_balance')
  return Number(response.balance ?? 0)
}

export async function nwcGetInfo(session: NwcSession): Promise<NwcResponse> {
  return nwcRequest(session, 'get_info')
}

export async function nwcPayInvoice(session: NwcSession, invoice: string): Promise<string> {
  const response = await nwcRequest(session, 'pay_invoice', { invoice })
  const preimage = typeof response.preimage === 'string' ? response.preimage : ''
  return preimage
}