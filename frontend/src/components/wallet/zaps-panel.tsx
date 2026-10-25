import * as React from 'react'
import { nip57 } from 'nostr-tools'
import { Zap } from 'lucide-react'
import { relayPool } from '@/services/nostr'
import { type NostrEvent } from '@/types/nostr'
import { formatTime } from '@/lib/feed'
import { formatSats } from '@/services/cashu'

interface ZapEntry {
  id: string
  amount: number
  from: string
  at: number
}

function parseZap(event: NostrEvent): ZapEntry {
  const amountTag = event.tags.find((tag) => tag[0] === 'amount')?.[1]
  const bolt11 = event.tags.find((tag) => tag[0] === 'bolt11')?.[1]
  const fromBolt = bolt11 ? nip57.getSatoshisAmountFromBolt11(bolt11) : 0
  const fromTag = amountTag ? Math.floor(Number(amountTag) / 1000) : 0
  return {
    id: event.id,
    amount: fromBolt || fromTag,
    from: event.tags.find((tag) => tag[0] === 'P')?.[1] ?? event.pubkey,
    at: event.created_at,
  }
}

export const ZapsPanel: React.FC<{ pubkey: string | null }> = ({ pubkey }) => {
  const [zaps, setZaps] = React.useState<ZapEntry[]>([])

  React.useEffect(() => {
    if (!pubkey) {
      setZaps([])
      return
    }
    const unsub = relayPool.subscribe([{ kinds: [9735], '#p': [pubkey], limit: 50 }], (event: NostrEvent) => {
      const entry = parseZap(event)
      setZaps((prev) => (prev.some((zap) => zap.id === entry.id) ? prev : [entry, ...prev]))
    })
    return unsub
  }, [pubkey])

  if (!pubkey) {
    return <div className="text-center text-sm text-muted-foreground py-8">Sign in to see received zaps.</div>
  }

  return (
    <div className="space-y-2">
      {zaps.map((zap) => (
        <div key={zap.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm">Zap from {zap.from.slice(0, 8)}…</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatSats(zap.amount)} sats · {formatTime(zap.at)}
          </div>
        </div>
      ))}
      {zaps.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">No zaps received yet.</div>
      )}
    </div>
  )
}