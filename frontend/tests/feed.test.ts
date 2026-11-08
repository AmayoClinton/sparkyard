import { describe, it, expect } from 'vitest'
import { type FeedItem, type NostrEvent, type UserProfile } from '../src/types/nostr'
import { hotScore, sortItems, tallyVotes, tallyReposts } from '../src/lib/feed'

const now = Math.floor(Date.now() / 1000)

function event(kind: number, id: string, pubkey: string, content: string, tags: string[][] = []): NostrEvent {
  return { id, pubkey, created_at: now, kind, tags, content, sig: '' }
}

function item(id: string, createdAt = now, up = 0, down = 0): FeedItem {
  return {
    event: { ...event(1, id, 'pubkey', '', []), created_at: createdAt },
    author: { pubkey: 'pubkey' } as UserProfile,
    reactions: { count: 0, userReacted: false },
    zaps: { amount: 0, count: 0 },
    replies: 0,
    reposts: 0,
    votes: { up, down, userVote: null },
  } as unknown as FeedItem
}

describe('feed lib', () => {
  it('tallyVotes counts up/down and tracks user vote', () => {
    const events = [
      event(7, 'r1', 'alice', '+', [['e', 'note1']]),
      event(7, 'r2', 'bob', '+', [['e', 'note1']]),
      event(7, 'r3', 'alice', '-', [['e', 'note2']]),
    ]
    const votes = tallyVotes(events, 'alice')
    expect(votes.get('note1')).toEqual({ up: 2, down: 0, userVote: 'up' })
    expect(votes.get('note2')).toEqual({ up: 0, down: 1, userVote: 'down' })
    expect(votes.has('note3')).toBe(false)
  })

  it('tallyVotes ignores non vote content', () => {
    const events = [event(7, 'r1', 'alice', 'heart', [['e', 'note1']])]
    expect(tallyVotes(events, 'alice').get('note1')).toEqual({ up: 0, down: 0, userVote: null })
  })

  it('tallyReposts counts and tracks user repost', () => {
    const events = [
      event(6, 'r1', 'alice', '', [['e', 'note1']]),
      event(6, 'r2', 'alice', '', [['e', 'note1']]),
      event(6, 'r3', 'bob', '', [['e', 'note2']]),
    ]
    const map = tallyReposts(events, 'alice')
    expect(map.get('note1')).toEqual({ count: 2, userReposted: true })
    expect(map.get('note2')).toEqual({ count: 1, userReposted: false })
  })

  it('hotScore decays with age and grows with score', () => {
    const fresh = hotScore(10, 0, now)
    const old = hotScore(10, 0, now - 3600 * 24)
    expect(fresh).toBeGreaterThan(old)
    const high = hotScore(20, 0, now)
    const low = hotScore(1, 0, now)
    expect(high).toBeGreaterThan(low)
  })

  it('sortItems new sorts by created_at desc', () => {
    const items = [item('a', now - 100), item('b', now), item('c', now - 50)]
    const sorted = sortItems(items, 'new')
    expect(sorted.map((i) => i.event.id)).toEqual(['b', 'c', 'a'])
  })

  it('sortItems top sorts by score desc', () => {
    const items = [
      item('a', now, 1, 0),
      item('b', now, 5, 0),
      item('c', now, 3, 0),
    ]
    const sorted = sortItems(items, 'top')
    expect(sorted.map((i) => i.event.id)).toEqual(['b', 'c', 'a'])
  })

  it('sortItems hot orders by decayed score', () => {
    const items = [item('a', now - 3600 * 24, 1, 0), item('b', now, 5, 0)]
    const sorted = sortItems(items, 'hot')
    expect(sorted[0].event.id).toBe('b')
  })
})
