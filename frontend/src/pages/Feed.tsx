import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { relayPool } from '@/services/nostr'
import { getSigner } from '@/services/auth'
import { parseProfileEvent } from '@/services/identity'
import { getEventHash } from 'nostr-tools'
import { sortItems, tallyVotes, tallyReposts } from '@/lib/feed'
import { type FeedItem, type NostrEvent, type SortMode, type Story, type UserProfile } from '@/types/nostr'
import { isPushEnabled } from '@/services/settings'
import { isMention, notify } from '@/services/push'
import { Composer } from '@/components/feed/composer'
import { StoriesRow } from '@/components/feed/stories-row'
import { NoteCard } from '@/components/feed/note-card'

export const FeedPage: React.FC = () => {
  const navigate = useNavigate()
  const [items, setItems] = React.useState<FeedItem[]>([])
  const [profiles, setProfiles] = React.useState<Map<string, UserProfile>>(new Map())
  const [stories, setStories] = React.useState<Map<string, Story>>(new Map())
  const [seenStories, setSeenStories] = React.useState<Set<string>>(new Set())
  const [reactions, setReactions] = React.useState<NostrEvent[]>([])
  const [reposts, setReposts] = React.useState<NostrEvent[]>([])
  const [repliesByRoot, setRepliesByRoot] = React.useState<Map<string, number>>(new Map())
  const [connected, setConnected] = React.useState<string[]>([])
  const [sortMode, setSortMode] = React.useState<SortMode>('new')

  const signer = getSigner()
  const [myPubkey, setMyPubkey] = React.useState<string | null>(null)

  React.useEffect(() => {
    setConnected(relayPool.getConnectedRelays())
    const interval = setInterval(() => setConnected(relayPool.getConnectedRelays()), 5000)
    return () => clearInterval(interval)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      const active = getSigner()
      if (!active) return
      const pubkey = await active.getPublicKey()
      if (!cancelled) setMyPubkey(pubkey)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [signer])

  const profilesRef = React.useRef(profiles)
  React.useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])
  const myPubkeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    myPubkeyRef.current = myPubkey
  }, [myPubkey])
  const mountedAt = React.useRef(Math.floor(Date.now() / 1000))
  const storiesRef = React.useRef(stories)
  React.useEffect(() => {
    storiesRef.current = stories
  }, [stories])
  const repliesRef = React.useRef(repliesByRoot)
  React.useEffect(() => {
    repliesRef.current = repliesByRoot
  }, [repliesByRoot])

  const now = () => Math.floor(Date.now() / 1000)

  React.useEffect(() => {
    return relayPool.subscribe([{ kinds: [1], limit: 100 }], (event: NostrEvent) => {
      const expiration = event.tags.find((tag) => tag[0] === 'expiration')?.[1]
      const expiresAt = expiration ? Number(expiration) : 0
      if (expiresAt && expiresAt > Date.now() / 1000 && !storiesRef.current.has(event.id)) {
        setStories((prev) => {
          const next = new Map(prev)
          next.set(event.id, {
            event,
            author: profilesRef.current.get(event.pubkey) ?? { pubkey: event.pubkey },
            expiresAt,
          })
          return next
        })
      }
      setRepliesByRoot((prev) => {
        const next = new Map(prev)
        for (const tag of event.tags) {
          if (tag[0] === 'e') next.set(tag[1], (next.get(tag[1]) ?? 0) + 1)
        }
        return next
      })
      setItems((prev) => {
        if (prev.some((item) => item.event.id === event.id)) return prev
        const author = profilesRef.current.get(event.pubkey) ?? { pubkey: event.pubkey }
        const item: FeedItem = {
          event,
          author,
          reactions: { count: 0, userReacted: false },
          zaps: { amount: 0, count: 0 },
          replies: repliesRef.current.get(event.id) ?? 0,
          reposts: 0,
          votes: { up: 0, down: 0, userVote: null },
        }
        return [item, ...prev].sort((a, b) => b.event.created_at - a.event.created_at).slice(0, 200)
      })

      const me = myPubkeyRef.current
      if (
        me &&
        event.pubkey !== me &&
        event.created_at >= mountedAt.current &&
        isMention(event.content, me) &&
        isPushEnabled()
      ) {
        notify({ title: 'You were mentioned', body: event.content.slice(0, 120), tag: `mention:${event.id}` })
      }
    })
  }, [])

  React.useEffect(() => {
    return relayPool.subscribe([{ kinds: [0], limit: 100 }], (event: NostrEvent) => {
      const parsed = parseProfileEvent(event)
      setProfiles((prev) => {
        const next = new Map(prev)
        next.set(event.pubkey, { pubkey: event.pubkey, ...parsed } as UserProfile)
        return next
      })
    })
  }, [])

  React.useEffect(() => {
    return relayPool.subscribe([{ kinds: [7], limit: 200 }], (event: NostrEvent) => {
      setReactions((prev) => (prev.some((entry) => entry.id === event.id) ? prev : [event, ...prev].slice(0, 500)))
    })
  }, [])

  React.useEffect(() => {
    return relayPool.subscribe([{ kinds: [6], limit: 200 }], (event: NostrEvent) => {
      setReposts((prev) => (prev.some((entry) => entry.id === event.id) ? prev : [event, ...prev].slice(0, 500)))
    })
  }, [])

  const votesMap = React.useMemo(() => tallyVotes(reactions, myPubkey), [reactions, myPubkey])
  const repostsMap = React.useMemo(() => tallyReposts(reposts, myPubkey), [reposts, myPubkey])
  const sorted = React.useMemo(
    () =>
      sortItems(
        items.map((item) => ({
          ...item,
          votes: votesMap.get(item.event.id) ?? { up: 0, down: 0, userVote: null },
          reposts: repostsMap.get(item.event.id)?.count ?? item.reposts,
        })),
        sortMode
      ),
    [items, sortMode, votesMap, repostsMap]
  )

  const vote = async (item: FeedItem, direction: 'up' | 'down') => {
    if (!signer || item.votes.userVote === direction) return
    const pubkey = await signer.getPublicKey()
    const targetId = item.event.id

    setItems((prev) =>
      prev.map((entry) => {
        if (entry.event.id !== targetId) return entry
        const votes = entry.votes
        let up = votes.up
        let down = votes.down
        if (votes.userVote === 'up') up--
        else if (votes.userVote === 'down') down--
        if (direction === 'up') up++
        else down++
        return { ...entry, votes: { up, down, userVote: direction } }
      })
    )

    const event: NostrEvent = {
      kind: 7,
      pubkey,
      created_at: now(),
      tags: [['e', targetId], ['p', item.event.pubkey]],
      content: direction,
      id: '',
      sig: '',
    }
    event.id = getEventHash(event)
    const signed = await signer.signEvent(event)
    await relayPool.publish(signed)
  }

  const repost = async (item: FeedItem) => {
    if (!signer) return
    const pubkey = await signer.getPublicKey()
    const event: NostrEvent = {
      kind: 6,
      pubkey,
      created_at: now(),
      tags: [['e', item.event.id], ['p', item.event.pubkey]],
      content: '',
      id: '',
      sig: '',
    }
    event.id = getEventHash(event)
    const signed = await signer.signEvent(event)
    await relayPool.publish(signed)
  }

  const openThread = (eventId: string) => navigate(`/notes/${eventId}`)
  const sortLabel = (mode: SortMode) => (mode === 'new' ? 'New' : mode === 'top' ? 'Top' : 'Hot')

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {connected.length > 0
            ? `Connected to ${connected.length} relay${connected.length > 1 ? 's' : ''}`
            : 'Connecting...'}
        </span>
        <span className="font-mono">{connected.map((url) => new URL(url).hostname).join(', ')}</span>
      </div>

      <StoriesRow
        stories={Array.from(stories.values())}
        seen={seenStories}
        onSeen={(id) =>
          setSeenStories((prev) => {
            const next = new Set(prev)
            next.add(id)
            return next
          })
        }
      />

      <div className="flex gap-2 text-xs text-muted-foreground">
        {(['new', 'top', 'hot'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`px-2 py-1 rounded border transition-colors ${
              sortMode === mode ? 'border-accent bg-accent/10 text-accent' : 'border-transparent hover:border-border/50'
            }`}
          >
            {sortLabel(mode)}
          </button>
        ))}
      </div>

      <Composer />

      <div className="space-y-3">
        {sorted.map((item) => (
          <NoteCard key={item.event.id} item={item} onOpen={openThread} onVote={vote} onRepost={repost} />
        ))}
        {sorted.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No notes yet. Start posting or wait for relays to sync.
          </div>
        )}
      </div>
    </div>
  )
}