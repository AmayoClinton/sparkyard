import { getEventHash, nip57 } from 'nostr-tools'
import { relayPool, DEFAULT_RELAYS } from '@/services/nostr'
import { getSigner } from '@/services/auth'
import { resolveLnurl, satsToMsats } from '@/lib/lightning'
import { type NostrEvent, type UserProfile } from '@/types/nostr'

export interface LnurlPayData {
  callback: string
  minSendable: number
  maxSendable: number
  metadata: string
  allowsNostr?: boolean
  nostrPubkey?: string
}

export interface LnurlInvoice {
  pr: string
  routes?: unknown[]
  successAction?: unknown
}

export interface ZapTarget {
  recipient: string
  profile?: Pick<UserProfile, 'lud16' | 'lud06'> | null
  note?: NostrEvent
}

export interface ZapPlan {
  zapRequest: NostrEvent
  zapRequestJson: string
  endpoint: string
  amountMsats: number
  pay: LnurlPayData
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

export async function fetchLnurlPay(endpoint: string): Promise<LnurlPayData> {
  const data = await fetchJson(endpoint)
  if (data.status === 'ERROR') throw new Error(String(data.reason ?? 'LNURL error'))
  if (data.tag !== 'payRequest') throw new Error('Not a LNURL-pay endpoint')
  const callback = typeof data.callback === 'string' ? data.callback : ''
  if (!callback) throw new Error('LNURL-pay callback missing')
  return {
    callback,
    minSendable: Number(data.minSendable ?? 1),
    maxSendable: Number(data.maxSendable ?? 0),
    metadata: String(data.metadata ?? ''),
    allowsNostr: data.allowsNostr === true,
    nostrPubkey: typeof data.nostrPubkey === 'string' ? data.nostrPubkey : undefined,
  }
}

export async function requestInvoice(
  pay: LnurlPayData,
  amountMsats: number,
  zapRequestJson?: string
): Promise<LnurlInvoice> {
  const url = new URL(pay.callback)
  url.searchParams.set('amount', String(amountMsats))
  if (zapRequestJson) url.searchParams.set('nostr', zapRequestJson)
  const data = await fetchJson(url.toString())
  if (data.status === 'ERROR') throw new Error(String(data.reason ?? 'Invoice request failed'))
  if (typeof data.pr !== 'string' || !data.pr) {
    throw new Error(String(data.reason ?? 'No invoice returned'))
  }
  return data as unknown as LnurlInvoice
}

function activeRelays(): string[] {
  const connected = relayPool.getConnectedRelays()
  return connected.length > 0 ? connected : DEFAULT_RELAYS.map((r) => r.url)
}

export async function prepareZap(target: ZapTarget, amountSats: number, comment = ''): Promise<ZapPlan> {
  const signer = getSigner()
  if (!signer) throw new Error('Sign in to send a zap')
  const pubkey = await signer.getPublicKey()
  const endpoint = resolveLnurl(target.profile)
  if (!endpoint) throw new Error('No Lightning address on this profile')

  const pay = await fetchLnurlPay(endpoint)
  const amountMsats = satsToMsats(amountSats)
  if (amountMsats < pay.minSendable) throw new Error(`Minimum zap is ${Math.ceil(pay.minSendable / 1000)} sats`)
  if (pay.maxSendable > 0 && amountMsats > pay.maxSendable) {
    throw new Error(`Maximum zap is ${Math.floor(pay.maxSendable / 1000)} sats`)
  }

  const template = target.note
    ? nip57.makeZapRequest({ event: target.note, amount: amountMsats, relays: activeRelays(), comment })
    : nip57.makeZapRequest({ pubkey: target.recipient, amount: amountMsats, relays: activeRelays(), comment })

  const unsigned = { ...template, pubkey, id: '', sig: '' } as NostrEvent
  unsigned.id = getEventHash(unsigned)
  const signed = await signer.signEvent(unsigned)

  return {
    zapRequest: signed,
    zapRequestJson: JSON.stringify(signed),
    endpoint: pay.callback,
    amountMsats,
    pay,
  }
}

export async function payWithWebln(invoice: string): Promise<string> {
  const webln = (window as unknown as { webln?: { enable(): Promise<void>; sendPayment(i: string): Promise<{ preimage?: string }> } }).webln
  if (!webln) throw new Error('No WebLN wallet found. Connect an NWC wallet in the Wallet tab.')
  await webln.enable()
  const result = await webln.sendPayment(invoice)
  return result.preimage ?? ''
}

export async function publishZapReceipt(
  zapRequestJson: string,
  invoice: string,
  preimage: string
): Promise<NostrEvent> {
  const signer = getSigner()
  if (!signer) throw new Error('Sign in to publish a zap receipt')
  const pubkey = await signer.getPublicKey()
  const template = nip57.makeZapReceipt({ zapRequest: zapRequestJson, bolt11: invoice, preimage, paidAt: new Date() })
  const unsigned = { ...template, pubkey, id: '', sig: '' } as NostrEvent
  unsigned.id = getEventHash(unsigned)
  const signed = await signer.signEvent(unsigned)
  await relayPool.publish(signed)
  return signed
}