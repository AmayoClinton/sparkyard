import * as React from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type DirectMessage } from '@/services/dm'
import { formatTime } from '@/lib/feed'

interface DMThreadProps {
  peer: string
  peerName?: string
  peerPicture?: string
  myPubkey: string
  messages: DirectMessage[]
  onSend: (content: string) => Promise<void>
  onBack: () => void
}

export const DMThread: React.FC<DMThreadProps> = ({
  peer,
  peerName,
  peerPicture,
  myPubkey,
  messages,
  onSend,
  onBack,
}) => {
  const [draft, setDraft] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const send = async () => {
    if (!draft.trim() || busy) return
    setBusy(true)
    try {
      await onSend(draft)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar pubkey={peer} displayName={peerName} picture={peerPicture} size={34} />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{peerName ?? `${peer.slice(0, 8)}…`}</div>
          <div className="text-[10px] text-muted-foreground">End-to-end encrypted</div>
        </div>
      </div>

      <div className="space-y-2">
        {messages.map((message) => {
          const mine = message.sender === myPubkey
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words ${
                  mine ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`text-[10px] mt-1 ${mine ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
                  {formatTime(message.createdAt)}
                </div>
              </div>
            </div>
          )
        })}
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">Say hello — messages are encrypted.</div>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Send an encrypted message…"
            className="w-full min-h-[60px] bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={send} disabled={busy || !draft.trim()}>
              <Send className="h-4 w-4 mr-1" /> {busy ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}