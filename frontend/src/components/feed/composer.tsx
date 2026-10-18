import * as React from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getSigner } from '@/services/auth'
import { relayPool } from '@/services/nostr'
import { getEventHash } from 'nostr-tools'
import { type NostrEvent } from '@/types/nostr'

export const Composer: React.FC = () => {
  const [draft, setDraft] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const publish = async () => {
    const signer = getSigner()
    if (!signer || !draft.trim()) return
    setBusy(true)
    try {
      const pubkey = await signer.getPublicKey()
      const event: NostrEvent = {
        kind: 1,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: draft.trim(),
        id: '',
        sig: '',
      }
      event.id = getEventHash(event)
      const signed = await signer.signEvent(event)
      await relayPool.publish(signed)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  if (!getSigner()) return null

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What's on your mind?"
          className="w-full min-h-[80px] bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground"
          maxLength={280}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{draft.length}/280</span>
          <Button size="sm" onClick={publish} disabled={busy || !draft.trim()}>
            <Send className="h-4 w-4 mr-1" />
            Post
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}