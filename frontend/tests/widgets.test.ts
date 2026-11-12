import { describe, it, expect } from 'vitest'
import { isWidgetAllowed, MIN_WIDGET_REPUTATION, parseWidget, widgetFrameProps } from '../src/services/widgets'
import { type NostrEvent } from '../src/types/nostr'

function event(tags: string[][]): NostrEvent {
  return { id: 'id', pubkey: 'author', created_at: 1_700_000_000, kind: 30033, tags, content: '', sig: '' }
}

describe('smart widgets', () => {
  it('parses kind 30033 metadata', () => {
    const widget = parseWidget(
      event([
        ['d', 'weather'],
        ['url', 'https://apps.example.com/weather'],
        ['title', 'Weather'],
        ['summary', 'Local forecast'],
        ['reputation', '42'],
      ])
    )
    expect(widget).not.toBeNull()
    expect(widget?.id).toBe('weather')
    expect(widget?.title).toBe('Weather')
    expect(widget?.reputation).toBe(42)
    expect(widget?.author).toBe('author')
  })

  it('requires an https url and a d tag', () => {
    expect(parseWidget(event([['url', 'http://apps.example.com']]))).toBeNull()
    expect(parseWidget(event([['url', 'https://apps.example.com']]))).toBeNull()
    expect(parseWidget(event([['d', 'x'], ['url', 'not-a-url']]))).toBeNull()
  })

  it('gates widgets by reputation and trusted authors', () => {
    const widget = parseWidget(
      event([
        ['d', 'game'],
        ['url', 'https://apps.example.com/game'],
        ['reputation', '3'],
      ])
    )!
    expect(isWidgetAllowed(widget)).toBe(false)
    expect(isWidgetAllowed(widget, ['someone-else'])).toBe(false)
    expect(isWidgetAllowed(widget, ['author'])).toBe(true)
    expect(isWidgetAllowed(widget, [], 2)).toBe(true)
  })

  it('uses a script-only sandbox with no same-origin access', () => {
    const props = widgetFrameProps({
      id: 'x',
      url: 'https://apps.example.com',
      title: 'X',
      author: 'author',
      createdAt: 1,
      reputation: MIN_WIDGET_REPUTATION,
    })
    expect(props.sandbox).toBe('allow-scripts')
    expect(props.sandbox).not.toContain('allow-same-origin')
    expect(props.referrerPolicy).toBe('no-referrer')
  })
})