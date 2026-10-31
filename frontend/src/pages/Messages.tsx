import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import { relayPool } from '@/services/nostr'
import { getSigner, supportsNip44 } from '@/services/auth'
import { sendDirectMessage, subscribeDirectMessages, type DirectMessage } from '@/services/dm'
import { parseProfileEvent } from '@/services/identity'
import { isPushEnabled } from '@/services/settings'
import { formatDirectMessageNotification, notify } from '@/services/push'
import { type NostrEvent, type UserProfile } from '@/types/nostr'
import { DMList, type DMThread } from '@/components/messages/dm-list'
import { DMThread as DMThreadView } from '@/components/messages/dm-thread'

export const MessagesPage: React.FC = () => {
  const { pubkey } = useParams<{ pubkey: string }>()
  const navigate = useNavigate()
  const peer = pubkey ? decodeURIComponent(pubkey) : ''

  const [myPubkey, setMyPubkey] = React.useState<string | null>(null)
  const [supported, setSupported] = React.useState(false)
  const [messagesByPeer, setMessagesByPeer] = React.useState<Map<string, DirectMessage[]>>(new Map())
  const [profiles, setProfiles] = React.useState<Map<string, UserProfile>>(new Map())
  const peerRef = React.useRef(peer)

  React.useEffect(() => {
    peerRef.current = peer
  }, [peer])

  React.useEffect(() => {
    const signer = getSigner()
    if (!signer) return
    setSupported(supportsNip44(signer))
    signer
      .getPublicKey()
      .then(setMyPubkey)
      .catch(() => setMyPubkey(null))
  }, [])

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
    if (!myPubkey || !supported) return
    return subscribeDirectMessages(myPubkey, (message) => {
      setMessagesByPeer((prev) => {
        const existing = prev.get(message.sender) ?? []
        if (existing.some((entry) => entry.id === message.id)) return prev
        const next = new Map(prev)
        next.set(message.sender, [...existing, message].sort((a, b) => a.createdAt - b.createdAt))
        return next
      })
      if (isPushEnabled()) {
        notify(formatDirectMessageNotification(message.sender, message.content))
      }
    })
  }, [myPubkey, supported])

  const threads: DMThread[] = Array.from(messagesByPeer.entries()).map(([sender, messages]) => {
    const last = messages[messages.length - 1]
    const profile = profiles.get(sender)
    return {
      peer: sender,
      name: profile?.displayName ?? profile?.name,
      picture: profile?.picture,
      lastMessage: last?.content ?? '',
      lastAt: last?.createdAt ?? 0,
    }
  })

  const activeMessages = peer ? messagesByPeer.get(peer) ?? [] : []
  const activeProfile = profiles.get(peer)

  const handleSend = async (content: string) => {
    if (!peer) return
    const message = await sendDirectMessage(peer, content)
    setMessagesByPeer((prev) => {
      const existing = prev.get(peer) ?? []
      const next = new Map(prev)
      next.set(peer, [...existing, message].sort((a, b) => a.createdAt - b.createdAt))
      return next
    })
  }

  if (!myPubkey) {
    return (
      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
        <h1 className="text-xl font-bold">Messages</h1>
        <div className="text-center text-sm text-muted-foreground py-12">
          Sign in with an NIP-07 extension to send and receive encrypted direct messages.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold">Messages</h1>
        <span className="text-[10px] text-muted-foreground ml-auto">NIP-17 · NIP-44</span>
      </div>

      {!supported && (
        <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span>
            This signer does not expose NIP-44 decryption. Use an NIP-07 extension with NIP-44 support (for example a
            recent Alby or nos2x) to read DMs. NIP-04 is never used.
          </span>
        </div>
      )}

      {peer ? (
        <DMThreadView
          peer={peer}
          peerName={activeProfile?.displayName ?? activeProfile?.name}
          peerPicture={activeProfile?.picture}
          myPubkey={myPubkey}
          messages={activeMessages}
          onSend={handleSend}
          onBack={() => navigate('/messages')}
        />
      ) : (
        <DMList threads={threads} onOpen={(target) => navigate(`/messages/${encodeURIComponent(target)}`)} />
      )}
    </div>
  )
}