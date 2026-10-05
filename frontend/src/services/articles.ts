import { relayPool } from '@/services/nostr'
import { getSigner } from '@/services/auth'
import { type NostrEvent, type UserProfile, type Article } from '@/types/nostr'
import { getEventHash } from 'nostr-tools'

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled'
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*]+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*>]\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseArticle(event: NostrEvent, author: UserProfile): Article {
  let title = ''
  for (const tag of event.tags) {
    if (tag[0] === 'd' && tag[1]) {
      title = tag[1]
      break
    }
  }
  if (!title) {
    const firstLine = event.content.split('\n')[0].replace(/^#{1,6}\s+/, '').trim()
    title = firstLine.slice(0, 80) || 'Untitled'
  }
  const plain = stripMarkdown(event.content)
  const tags: string[] = []
  for (const tag of event.tags) {
    if (tag[0] === 't' && tag[1]) tags.push(tag[1])
  }
  const wordCount = plain.split(/\s+/).filter(Boolean).length
  return {
    event,
    author,
    title,
    summary: plain.slice(0, 220) + (plain.length > 220 ? '…' : ''),
    publishedAt: event.created_at,
    tags,
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
  }
}

export interface PublishArticleInput {
  title: string
  content: string
  tags?: string[]
}

export async function publishArticle({
  title,
  content,
  tags = [],
}: PublishArticleInput): Promise<string> {
  const signer = getSigner()
  if (!signer) throw new Error('Not signed in')

  const pubkey = await signer.getPublicKey()
  const created_at = Math.floor(Date.now() / 1000)
  const d = slugify(title)

  const eventTags: string[][] = [['d', d], ...tags.map((t) => ['t', t])]

  const event: NostrEvent = {
    kind: 30023,
    pubkey,
    created_at,
    tags: eventTags,
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
    throw new Error(`Failed to publish article: ${reason}`)
  }
  return event.id
}
