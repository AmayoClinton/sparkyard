import * as React from 'react'
import { Radio, Search } from 'lucide-react'
import { relayPool } from '@/services/nostr'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/avatar'
import { formatTime } from '@/lib/feed'
import { broadcastFilter, isValidGroupId, normalizeGroupId } from '@/services/broadcast'
import { parseProfileEvent } from '@/services/identity'
import { type NostrEvent, type UserProfile } from '@/types/nostr'

interface BroadcastMessage {
  event: NostrEvent
  author: UserProfile
}

export const BroadcastPage: React.FC = () => {
  const [input, setInput] = React.useState('')
  const [activeId, setActiveId] = React.useState('')
  const [messages, setMessages] = React.useState<BroadcastMessage[]>([])
  const [profiles, setProfiles] = React.useState<Map<string, UserProfile>>(new Map())
  const [error, setError] = React.useState('')

  const profilesRef = React.useRef(profiles)
  React.useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])

  React.useEffect(() => {
    const unsub = relayPool.subscribe([{ kinds: [0], limit: 100 }], (event: NostrEvent) => {
      const parsed = parseProfileEvent(event)
      setProfiles((prev) => {
        const next = new Map(prev)
        next.set(event.pubkey, { pubkey: event.pubkey, ...parsed } as UserProfile)
        return next
      })
    })
    return unsub
  }, [])

  React.useEffect(() => {
    if (!activeId) return
    setMessages([])
    return relayPool.subscribe([broadcastFilter(activeId)], (event: NostrEvent) => {
      setMessages((prev) => {
        if (prev.some((entry) => entry.event.id === event.id)) return prev
        const author = profilesRef.current.get(event.pubkey) ?? { pubkey: event.pubkey }
        return [...prev, { event, author }].sort((a, b) => a.event.created_at - b.event.created_at)
      })
    })
  }, [activeId])

  const subscribe = () => {
    const id = normalizeGroupId(input)
    if (!isValidGroupId(id)) {
      setError('Enter a valid group ID')
      return
    }
    setError('')
    setActiveId(id)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold">Broadcast channels</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        Read-only NIP-29 channels. No membership or join request is needed — subscribe to kind 9 messages by group ID.
      </p>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="group id (e.g. bitcoin)"
          onKeyDown={(event) => {
            if (event.key === 'Enter') subscribe()
          }}
        />
        <Button size="sm" onClick={subscribe}>
          <Search className="h-4 w-4 mr-1" /> Read
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {activeId && (
        <div className="text-xs text-muted-foreground">
          Reading <span className="font-mono text-foreground">#{activeId}</span> · {messages.length} messages
        </div>
      )}

      <div className="space-y-3">
        {messages.map((entry) => (
          <Card key={entry.event.id}>
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Avatar
                  pubkey={entry.event.pubkey}
                  displayName={entry.author.displayName ?? entry.author.name}
                  picture={entry.author.picture}
                  size={34}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold truncate">
                      {entry.author.displayName ?? entry.author.name ?? 'Anonymous'}
                    </span>
                    <span className="text-muted-foreground text-xs">{formatTime(entry.event.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{entry.event.content}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {activeId && messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No broadcast messages yet. Share the group ID with others.
          </div>
        )}
        {!activeId && (
          <div className="text-center text-sm text-muted-foreground py-10">
            Enter a group ID to read its public broadcast channel.
          </div>
        )}
      </div>
    </div>
  )
}