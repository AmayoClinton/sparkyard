import * as React from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { relayPool } from '@/services/nostr'
import { getSigner } from '@/services/auth'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type NostrEvent, type ThreadNode, type UserProfile } from '@/types/nostr'
import { parseProfileEvent } from '@/services/identity'
import { getEventHash } from 'nostr-tools'
import { formatTime, resolveAuthor } from '@/lib/feed'

export function parentIdOf(event: NostrEvent): string | null {
  const eTags = event.tags.filter((tag) => tag[0] === 'e').map((tag) => tag[1])
  return eTags.length ? eTags[eTags.length - 1] : null
}

export function buildThread(
  root: { event: NostrEvent; author: UserProfile },
  replies: { event: NostrEvent; author: UserProfile }[]
): ThreadNode[] {
  const all = [root, ...replies]
  const byId = new Map<string, { event: NostrEvent; author: UserProfile }>()
  for (const entry of all) byId.set(entry.event.id, entry)

  const children = new Map<string, { event: NostrEvent; author: UserProfile }[]>()
  for (const entry of all) {
    const parent = parentIdOf(entry.event)
    if (!parent || !byId.has(parent)) continue
    const arr = children.get(parent) ?? []
    arr.push(entry)
    children.set(parent, arr)
  }

  const toNode = (
    entry: { event: NostrEvent; author: UserProfile },
    depth: number
  ): ThreadNode => ({
    event: entry.event,
    author: entry.author,
    replies: (children.get(entry.event.id) ?? []).map((child) => toNode(child, depth + 1)),
    depth,
  })

  return [toNode(root, 0)]
}

export const ThreadViewPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [root, setRoot] = React.useState<{ event: NostrEvent; author: UserProfile } | null>(null)
  const [replies, setReplies] = React.useState<Array<{ event: NostrEvent; author: UserProfile }>>([])
  const [profiles, setProfiles] = React.useState<Map<string, UserProfile>>(new Map())
  const [draft, setDraft] = React.useState('')
  const [replyTo, setReplyTo] = React.useState<{ event: NostrEvent; author: UserProfile } | null>(null)

  React.useEffect(() => {
    if (!eventId) return
    const rootUnsub = relayPool.subscribe(
      [{ kinds: [1], ids: [eventId] }],
      (event: NostrEvent) => {
        const author = resolveAuthor(event, profiles)
        setRoot({ event, author })
      }
    )
    const repliesUnsub = relayPool.subscribe(
      [{ kinds: [1], '#e': [eventId], limit: 200 }],
      (event: NostrEvent) => {
        const author = resolveAuthor(event, profiles)
        setReplies((prev) => {
          if (prev.some((r) => r.event.id === event.id)) return prev
          return [...prev, { event, author }]
        })
      }
    )
    const metaUnsub = relayPool.subscribe(
      [{ kinds: [0], limit: 200 }],
      (event: NostrEvent) => {
        const parsed = parseProfileEvent(event)
        const profile = { pubkey: event.pubkey, ...parsed } as UserProfile
        setProfiles((prev) => {
          const next = new Map(prev)
          next.set(event.pubkey, profile)
          return next
        })
        setRoot((current) => {
          if (!current || current.event.pubkey !== event.pubkey) return current
          return { event: current.event, author: profile }
        })
        setReplies((prev) => prev.map((r) => (r.event.pubkey === event.pubkey ? { ...r, author: profile } : r)))
      }
    )
    return () => {
      rootUnsub()
      repliesUnsub()
      metaUnsub()
    }
  }, [eventId, profiles])

  const threads = root ? buildThread(root, replies) : []

  const sendReply = async () => {
    if (!draft.trim() || !root) return
    const signer = getSigner()
    if (!signer) return
    const pubkey = await signer.getPublicKey()
    const created_at = Math.floor(Date.now() / 1000)

    const eTags: string[] = [root.event.id]
    const pTags: string[] = [root.event.pubkey]
    if (replyTo) {
      eTags.push(replyTo.event.id)
      if (replyTo.event.pubkey !== root.event.pubkey) pTags.push(replyTo.event.pubkey)
    }

    const event: NostrEvent = {
      kind: 1,
      pubkey,
      created_at,
      tags: [...eTags.map((id) => ['e', id]), ...pTags.map((pk) => ['p', pk])],
      content: draft.trim(),
      id: '',
      sig: '',
    }
    event.id = getEventHash(event)
    const signed = await signer.signEvent(event)
    await relayPool.publish(signed)
    setDraft('')
    setReplyTo(null)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {root && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Thread</h1>
            <div className="text-xs text-muted-foreground">{formatTime(root.event.created_at)}</div>
          </div>
        )}
      </div>

      {threads.map((node) => (
        <React.Fragment key={node.event.id}>
          <div className="mb-4" style={{ paddingLeft: `${node.depth * 6}px` }}>
            <Card className="overflow-hidden">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Avatar
                    pubkey={node.event.pubkey}
                    displayName={node.author.displayName ?? node.author.name}
                    picture={node.author.picture}
                    size={34}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold truncate">
                        {node.author.displayName ?? node.author.name ?? 'Anonymous'}
                      </span>
                      <span className="text-muted-foreground text-xs">{formatTime(node.event.created_at)}</span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap break-words">{node.event.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-muted-foreground">
                      <button
                        className="text-xs hover:text-accent transition-colors"
                        onClick={() => setReplyTo({ event: node.event, author: node.author })}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
                {node.replies.length > 0 && (
                  <div className="mt-3">
                    {node.replies.map((child) => (
                      <ThreadReply key={child.event.id} node={child} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </React.Fragment>
      ))}

      {getSigner() && root && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyTo ? 'Replying to comment…' : 'Reply to this note…'}
              className="w-full min-h-[80px] bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between">
              {replyTo && (
                <Button variant="outline" size="sm" onClick={() => setReplyTo(null)}>
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={sendReply} disabled={!draft.trim()}>
                <Send className="h-4 w-4 mr-1" />
                Reply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ThreadReply({ node }: { node: ThreadNode }): React.ReactNode {
  return (
    <div className="mb-3 pl-4 border-l-2 border-accent/30">
      <Card className="overflow-hidden">
        <CardContent className="pt-3">
          <div className="flex gap-2">
            <Avatar
              pubkey={node.event.pubkey}
              displayName={node.author.displayName ?? node.author.name}
              picture={node.author.picture}
              size={30}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold truncate">
                  {node.author.displayName ?? node.author.name ?? 'Anonymous'}
                </span>
                <span className="text-muted-foreground text-xs">{formatTime(node.event.created_at)}</span>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{node.event.content}</p>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <button className="text-xs hover:text-accent transition-colors">
                  Reply
                </button>
              </div>
            </div>
          </div>
          {node.replies.length > 0 && (
            <div className="mt-2">
              {node.replies.map((child) => (
                <ThreadReply key={child.event.id} node={child} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
