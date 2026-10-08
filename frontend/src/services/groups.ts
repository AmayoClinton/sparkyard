import { relayPool } from '@/services/nostr'
import { getSigner } from '@/services/auth'
import { type NostrEvent } from '@/types/nostr'
import { getEventHash } from 'nostr-tools'

export interface GroupMeta {
  id: string
  name: string
  description: string
  picture?: string
}

export async function createGroup(
  groupId: string,
  name: string,
  description: string,
  picture?: string
): Promise<void> {
  const signer = getSigner()
  if (!signer) throw new Error('Not signed in')

  const pubkey = await signer.getPublicKey()
  const created_at = Math.floor(Date.now() / 1000)

  // Step 1: Publish kind:9007 to create the group
  const createEvent: NostrEvent = {
    kind: 9007,
    pubkey,
    created_at,
    tags: [['h', groupId]],
    content: '',
    id: '',
    sig: '',
  }
  createEvent.id = getEventHash(createEvent)
  const signedCreate = await signer.signEvent(createEvent)
  const createResults = await relayPool.publish(signedCreate)

  const createAccepted = createResults.some((r) => r.accepted)
  if (!createAccepted) {
    const reason = createResults.find((r) => !r.accepted)?.reason || 'Unknown error'
    throw new Error(`Failed to create group: ${reason}`)
  }

  // Step 2: Publish kind:39000 to set group metadata
  const metaTags: string[][] = [
    ['h', groupId],
    ['name', name],
  ]
  if (description) metaTags.push(['description', description])
  if (picture) metaTags.push(['picture', picture])

  const metaEvent: NostrEvent = {
    kind: 39000,
    pubkey,
    created_at,
    tags: metaTags,
    content: JSON.stringify({ name, description, picture }),
    id: '',
    sig: '',
  }
  metaEvent.id = getEventHash(metaEvent)
  const signedMeta = await signer.signEvent(metaEvent)
  await relayPool.publish(signedMeta)
}

export async function joinGroup(groupId: string): Promise<void> {
  const signer = getSigner()
  if (!signer) throw new Error('Not signed in')

  const pubkey = await signer.getPublicKey()
  const event: NostrEvent = {
    kind: 9021,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['h', groupId]],
    content: '',
    id: '',
    sig: '',
  }
  event.id = getEventHash(event)
  const signed = await signer.signEvent(event)
  const results = await relayPool.publish(signed)

  const accepted = results.some((r) => r.accepted)
  if (!accepted) {
    const reason = results.find((r) => !r.accepted)?.reason || 'Unknown error'
    throw new Error(`Failed to join group: ${reason}`)
  }
}

export async function leaveGroup(groupId: string): Promise<void> {
  const signer = getSigner()
  if (!signer) throw new Error('Not signed in')

  const pubkey = await signer.getPublicKey()
  const event: NostrEvent = {
    kind: 9001,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['h', groupId],
      ['p', pubkey],
    ],
    content: '',
    id: '',
    sig: '',
  }
  event.id = getEventHash(event)
  const signed = await signer.signEvent(event)
  const results = await relayPool.publish(signed)

  const accepted = results.some((r) => r.accepted)
  if (!accepted) {
    const reason = results.find((r) => !r.accepted)?.reason || 'Unknown error'
    throw new Error(`Failed to leave group: ${reason}`)
  }
}

export async function postGroupMessage(
  groupId: string,
  content: string
): Promise<void> {
  const signer = getSigner()
  if (!signer) throw new Error('Not signed in')

  const pubkey = await signer.getPublicKey()
  const event: NostrEvent = {
    kind: 9,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['h', groupId]],
    content: content.trim(),
    id: '',
    sig: '',
  }
  event.id = getEventHash(event)
  const signed = await signer.signEvent(event)
  const results = await relayPool.publish(signed)

  const accepted = results.some((r) => r.accepted)
  if (!accepted) {
    const reason = results.find((r) => !r.accepted)?.reason || 'Unknown error'
    throw new Error(`Failed to post message: ${reason}`)
  }
}