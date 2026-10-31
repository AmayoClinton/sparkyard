import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Users } from 'lucide-react'
import { relayPool } from '@/services/nostr'
import { getSigner } from '@/services/auth'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type NostrEvent, type UserProfile } from '@/types/nostr'
import { parseProfileEvent } from '@/services/identity'
import { postGroupMessage } from '@/services/groups'

interface ChannelMessage {
  event: NostrEvent
  author: UserProfile
}

function formatTime(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export const ServerDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const decodedId = decodeURIComponent(groupId || '')

  const [messages, setMessages] = React.useState<ChannelMessage[]>([])
  const [profiles, setProfiles] = React.useState<Map<string, UserProfile>>(new Map())
  const [draft, setDraft] = React.useState('')

  const profilesRef = React.useRef<Map<string, UserProfile>>(new Map())
  React.useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])

  React.useEffect(() => {
    if (!decodedId) return
    const unsub = relayPool.subscribe(
      [{ kinds: [9], '#h': [decodedId], limit: 50 }],
      (event: NostrEvent) => {
        setMessages((prev) => {
          if (prev.some((m) => m.event.id === event.id)) return prev
          const author = profilesRef.current.get(event.pubkey) || { pubkey: event.pubkey }
          return [...prev, { event, author }].sort((a, b) => a.event.created_at - b.event.created_at)
        })
      }
    )
    return unsub
  }, [decodedId])

  React.useEffect(() => {
    const unsub = relayPool.subscribe(
      [{ kinds: [0], limit: 100 }],
      (event: NostrEvent) => {
        const parsed = parseProfileEvent(event)
        const profile = { pubkey: event.pubkey, ...parsed } as UserProfile
        setProfiles((prev) => {
          const next = new Map(prev)
          next.set(event.pubkey, profile)
          return next
        })
        setMessages((prev) =>
          prev.map((m) => (m.event.pubkey === event.pubkey ? { ...m, author: profile } : m))
        )
      }
    )
    return unsub
  }, [])

  const sendMessage = async () => {
    if (!draft.trim() || !decodedId) return
    try {
      await postGroupMessage(decodedId, draft.trim())
      setDraft('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to post message')
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/servers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{decodedId}</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> Group channel
          </div>
        </div>
      </div>

      {getSigner() && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message #${decodedId}`}
              className="w-full min-h-[60px] bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={sendMessage} disabled={!draft.trim()}>
                <Send className="h-4 w-4 mr-1" /> Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {messages.map((msg) => (
          <Card key={msg.event.id}>
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Avatar
                  pubkey={msg.event.pubkey}
                  displayName={msg.author.displayName || msg.author.name}
                  picture={msg.author.picture}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold truncate">
                      {msg.author.displayName || msg.author.name || 'Anonymous'}
                    </span>
                    <span className="text-muted-foreground text-xs">{formatTime(msg.event.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{msg.event.content}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Be the first to post.
          </div>
        )}
      </div>
    </div>
  )
}
