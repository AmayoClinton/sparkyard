import { describe, it, expect } from 'vitest'
import { type NostrEvent, type ThreadNode, type UserProfile } from '../src/types/nostr'
import { parentIdOf, buildThread } from '../src/pages/ThreadView'

const author: UserProfile = { pubkey: 'author' }

function event(id: string, content: string, tags: string[][] = []): NostrEvent {
  return { id, pubkey: 'author', created_at: 1_700_000_000, kind: 1, tags, content, sig: '' }
}

function entry(id: string, tags: string[][] = []) {
  return { event: event(id, `body ${id}`, tags), author }
}

describe('thread helpers', () => {
  it('parentIdOf returns last e-tag', () => {
    expect(parentIdOf(event('root', 'root', []))).toBeNull()
    expect(parentIdOf(event('r1', 'reply to root', [['e', 'root']]))).toBe('root')
    expect(parentIdOf(event('r2', 'reply to reply', [['e', 'root'], ['e', 'r1']]))).toBe('r1')
  })

  it('buildThread nests replies under root', () => {
    const root = entry('root')
    const replies = [
      entry('r1', [['e', 'root']]),
      entry('r2', [['e', 'root']]),
      entry('r3', [['e', 'root'], ['e', 'r1']]),
    ]
    const threads = buildThread(root, replies)
    expect(threads).toHaveLength(1)
    expect(threads[0].event.id).toBe('root')
    expect(threads[0].replies.map((r) => r.event.id)).toEqual(['r1', 'r2'])
    expect(threads[0].replies[0].depth).toBe(1)
    expect(threads[0].replies[0].replies.map((r) => r.event.id)).toEqual(['r3'])
    expect(threads[0].replies[0].replies[0].depth).toBe(2)
  })
})

type Node = ThreadNode
const collectDepths = (nodes: Node[], out: number[] = []): number[] => {
  for (const n of nodes) {
    out.push(n.depth)
    collectDepths(n.replies, out)
  }
  return out
}

describe('thread tree shape', () => {
  it('covers root and nested depths', () => {
    const root = entry('root')
    const replies = [entry('r1', [['e', 'root']]), entry('r2', [['e', 'root'], ['e', 'r1']])]
    const depths = collectDepths(buildThread(root, replies))
    expect(depths.sort((a, b) => a - b)).toEqual([0, 1, 2])
  })
})
