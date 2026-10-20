import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { formatTime } from '@/lib/feed'

export interface DMThread {
  peer: string
  name?: string
  picture?: string
  lastMessage: string
  lastAt: number
}

interface DMListProps {
  threads: DMThread[]
  onOpen: (peer: string) => void
}

export const DMList: React.FC<DMListProps> = ({ threads, onOpen }) => {
  const sorted = [...threads].sort((a, b) => b.lastAt - a.lastAt)

  if (sorted.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        No direct messages yet. Encrypted DMs from other users will appear here.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map((thread) => (
        <button
          key={thread.peer}
          onClick={() => onOpen(thread.peer)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-left hover:border-accent/50 transition-colors"
        >
          <Avatar
            pubkey={thread.peer}
            displayName={thread.name}
            picture={thread.picture}
            size={40}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{thread.name ?? `${thread.peer.slice(0, 8)}…`}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(thread.lastAt)}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{thread.lastMessage}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  )
}