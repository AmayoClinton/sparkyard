import { describe, it, expect } from 'vitest'
import { type NostrEvent, type UserProfile } from '../src/types/nostr'
import { slugify, stripMarkdown, parseArticle } from '../src/services/articles'

function mkEvent(content: string, tags: string[][] = []): NostrEvent {
  return {
    id: 'abc123',
    pubkey: 'publisher',
    created_at: 1_700_000_000,
    kind: 30023,
    tags,
    content,
    sig: '',
  }
}

const author: UserProfile = { pubkey: 'publisher', displayName: 'Alice' }

describe('articles service', () => {
  it('slugify produces clean ids', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('   ')).toBe('untitled')
    expect(slugify('---already---slug---')).toBe('already-slug')
  })

  it('stripMarkdown removes formatting', () => {
    expect(stripMarkdown('# Title\n\n**bold** *italic* `code` [link](https://x.com)')).toBe(
      'Title bold italic code link'
    )
  })

  it('parseArticle uses d-tag as title', () => {
    const article = parseArticle(mkEvent('body text', [['d', 'my-post']]), author)
    expect(article.title).toBe('my-post')
    expect(article.event.id).toBe('abc123')
  })

  it('parseArticle falls back to first line', () => {
    const article = parseArticle(mkEvent('# Headline\n\nrest of body'), author)
    expect(article.title).toBe('Headline')
  })

  it('parseArticle extracts t tags and reading time', () => {
    const article = parseArticle(mkEvent('word '.repeat(450), [['t', 'nostr'], ['t', 'bitcoin']]), author)
    expect(article.tags).toEqual(['nostr', 'bitcoin'])
    expect(article.readingTime).toBeGreaterThanOrEqual(1)
  })
})
