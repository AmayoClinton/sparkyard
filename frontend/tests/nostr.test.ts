import { describe, it, expect } from 'vitest'
import { type NostrFilter } from '../src/types/nostr'

describe('nostr types', () => {
  it('filter shape', () => {
    const f: NostrFilter = { kinds: [1], limit: 10 }
    expect(f.kinds).toContain(1)
  })
})
