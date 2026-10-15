import { type NostrEvent } from '@/types/nostr'

export interface Widget {
  id: string
  url: string
  title: string
  image?: string
  summary?: string
  author: string
  createdAt: number
  reputation: number
}

export const MIN_WIDGET_REPUTATION = 10

export const WIDGET_SANDBOX = 'allow-scripts'

function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name && tag.length >= 2)?.[1]
}

export function parseWidget(event: NostrEvent): Widget | null {
  const id = tagValue(event, 'd')
  const url = tagValue(event, 'url')
  if (!id || !url) return null
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }
  if (parsedUrl.protocol !== 'https:') return null
  const reputation = Number(tagValue(event, 'reputation') ?? 0)
  return {
    id,
    url,
    title: tagValue(event, 'title') ?? id,
    image: tagValue(event, 'image'),
    summary: tagValue(event, 'summary'),
    author: event.pubkey,
    createdAt: event.created_at,
    reputation: Number.isFinite(reputation) ? reputation : 0,
  }
}

export function isWidgetAllowed(
  widget: Widget,
  trustedAuthors: Iterable<string> = [],
  minReputation = MIN_WIDGET_REPUTATION
): boolean {
  const trusted = new Set(trustedAuthors)
  if (trusted.has(widget.author)) return true
  return widget.reputation >= minReputation
}

export function widgetFrameProps(widget: Widget): {
  src: string
  sandbox: string
  referrerPolicy: 'no-referrer'
  loading: 'lazy'
} {
  return {
    src: widget.url,
    sandbox: WIDGET_SANDBOX,
    referrerPolicy: 'no-referrer',
    loading: 'lazy',
  }
}