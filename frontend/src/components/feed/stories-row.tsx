import * as React from 'react'
import { Avatar } from '@/components/avatar'
import { type Story } from '@/types/nostr'

interface StoriesRowProps {
  stories: Story[]
  seen: Set<string>
  onSeen: (id: string) => void
}

export const StoriesRow: React.FC<StoriesRowProps> = ({ stories, seen, onSeen }) => {
  if (stories.length === 0) return null
  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">Stories</span>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {stories.map((story) => {
          const isSeen = seen.has(story.event.id)
          return (
            <div
              key={story.event.id}
              className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
              onClick={() => onSeen(story.event.id)}
            >
              <div className="relative w-10 h-10 shrink-0">
                <Avatar
                  pubkey={story.event.pubkey}
                  displayName={story.author.displayName ?? story.author.name}
                  picture={story.author.picture}
                  size={30}
                  className="relative z-10 ring-1 ring-inset ring-border"
                />
                <div
                  className={`absolute inset-0 rounded-full border-2 ${
                    isSeen ? 'border-muted' : 'border-accent'
                  }`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {story.author.displayName ?? story.author.name ?? 'Anonymous'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}