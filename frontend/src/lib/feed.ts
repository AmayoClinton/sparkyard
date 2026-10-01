import { type FeedItem, type NostrEvent, type SortMode, type UserProfile } from '@/types/nostr'

export interface VoteTally {
  up: number
  down: number
  userVote: 'up' | 'down' | null
}

export interface RepostTally {
  count: number
  userReposted: boolean
}

export function tallyVotes(events: NostrEvent[], myPubkey: string | null): Map<string, VoteTally> {
  const map = new Map<string, VoteTally>()
  for (const ev of events) {
    const target = ev.tags.find((tag) => tag[0] === 'e')?.[1]
    if (!target) continue
    const current = map.get(target) ?? { up: 0, down: 0, userVote: null }
    if (ev.content === '+') current.up++
    else if (ev.content === '-') current.down++
    if (myPubkey && ev.pubkey === myPubkey && (ev.content === '+' || ev.content === '-')) {
      current.userVote = ev.content === '+' ? 'up' : 'down'
    }
    map.set(target, current)
  }
  return map
}

export function tallyReposts(events: NostrEvent[], myPubkey: string | null): Map<string, RepostTally> {
  const map = new Map<string, RepostTally>()
  for (const ev of events) {
    const target = ev.tags.find((tag) => tag[0] === 'e')?.[1]
    if (!target) continue
    const current = map.get(target) ?? { count: 0, userReposted: false }
    current.count++
    if (myPubkey && ev.pubkey === myPubkey) current.userReposted = true
    map.set(target, current)
  }
  return map
}

export function hotScore(up: number, down: number, createdAt: number): number {
  const score = up - down
  const hours = Math.max(Date.now() / 1000 - createdAt, 0) / 3600
  return score / Math.pow(hours + 2, 1.5)
}

export function sortItems(items: FeedItem[], mode: SortMode): FeedItem[] {
  return [...items].sort((a, b) => {
    if (mode === 'new') return b.event.created_at - a.event.created_at
    if (mode === 'top') {
      const sa = a.votes.up - a.votes.down
      const sb = b.votes.up - b.votes.down
      if (sb !== sa) return sb - sa
      return b.event.created_at - a.event.created_at
    }
    const ha = hotScore(a.votes.up, a.votes.down, a.event.created_at)
    const hb = hotScore(b.votes.up, b.votes.down, b.event.created_at)
    return hb - ha
  })
}

export function formatTime(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function resolveAuthor(event: NostrEvent, profiles: Map<string, UserProfile>): UserProfile {
  return profiles.get(event.pubkey) ?? { pubkey: event.pubkey }
}
