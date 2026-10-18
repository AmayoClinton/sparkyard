import * as React from 'react'
import { ArrowDown, ArrowUp, MessageCircle, Repeat } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { ZapButton } from '@/components/zap-button'
import { formatTime } from '@/lib/feed'
import { type FeedItem } from '@/types/nostr'

interface NoteCardProps {
  item: FeedItem
  onOpen: (eventId: string) => void
  onVote: (item: FeedItem, direction: 'up' | 'down') => void
  onRepost: (item: FeedItem) => void
}

export const NoteCard: React.FC<NoteCardProps> = ({ item, onVote, onOpen, onRepost }) => {
  const stop = (event: React.MouseEvent) => event.stopPropagation()

  return (
    <Card className="overflow-hidden cursor-pointer" onClick={() => onOpen(item.event.id)}>
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar
            pubkey={item.event.pubkey}
            displayName={item.author.displayName ?? item.author.name}
            picture={item.author.picture}
            size={44}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm" onClick={stop}>
              <span className="font-semibold truncate">
                {item.author.displayName ?? item.author.name ?? 'Anonymous'}
              </span>
              {item.author.nip05 && (
                <span className="text-accent text-xs">✓ {item.author.nip05.split('@')[0]}</span>
              )}
              <span className="text-muted-foreground text-xs shrink-0">
                {formatTime(item.event.created_at)}
              </span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap break-words" onClick={stop}>
              {item.event.content}
            </p>

            <div className="flex items-center gap-5 mt-3 text-muted-foreground" onClick={stop}>
              <button
                className="flex items-center gap-1 text-xs hover:text-accent transition-colors"
                onClick={() => onOpen(item.event.id)}
              >
                <MessageCircle className="h-4 w-4" />
                {item.replies || ''}
              </button>
              <button
                className="flex items-center gap-1 text-xs hover:text-accent transition-colors"
                onClick={() => onRepost(item)}
              >
                <Repeat className="h-4 w-4" />
                {item.reposts || ''}
              </button>
              <button
                className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                  item.votes.userVote === 'up' ? 'text-accent' : 'text-muted-foreground hover:text-accent'
                }`}
                onClick={() => onVote(item, 'up')}
              >
                <ArrowUp className="h-4 w-4" />
                {item.votes.up || ''}
              </button>
              <button
                className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                  item.votes.userVote === 'down'
                    ? 'text-destructive'
                    : 'text-muted-foreground hover:text-destructive'
                }`}
                onClick={() => onVote(item, 'down')}
              >
                <ArrowDown className="h-4 w-4" />
                {item.votes.down || ''}
              </button>
              <ZapButton
                target={{ recipient: item.event.pubkey, profile: item.author, note: item.event }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}