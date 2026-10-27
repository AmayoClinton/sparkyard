import * as React from 'react'
import { ArrowLeft, Zap } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { relayPool } from '@/services/nostr'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/markdown'
import { ZapButton } from '@/components/zap-button'
import { type NostrEvent, type UserProfile } from '@/types/nostr'
import { parseProfileEvent } from '@/services/identity'
import { formatTime, resolveAuthor } from '@/lib/feed'
import { parseArticle } from '@/services/articles'

export const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = React.useState<ReturnType<typeof parseArticle> | null>(null)
  const [profiles, setProfiles] = React.useState<Map<string, UserProfile>>(new Map())
  const [related, setRelated] = React.useState<ReturnType<typeof parseArticle>[]>([])

  React.useEffect(() => {
    if (!id) return
    const unsub = relayPool.subscribe(
      [{ kinds: [30023], ids: [id] }],
      (event: NostrEvent) => {
        const author = resolveAuthor(event, profiles)
        setArticle(parseArticle(event, author))
      }
    )
    const meta = relayPool.subscribe(
      [{ kinds: [0], limit: 200 }],
      (event: NostrEvent) => {
        const parsed = parseProfileEvent(event)
        setProfiles((prev) => {
          const next = new Map(prev)
          next.set(event.pubkey, { pubkey: event.pubkey, ...parsed } as UserProfile)
          return next
        })
      }
    )
    return () => {
      unsub()
      meta()
    }
  }, [id, profiles])

  React.useEffect(() => {
    if (!article) return
    setRelated((prev) => {
      if (prev.some((a) => a.event.pubkey === article?.event.pubkey && a.event.id !== article.event.id)) return prev
      return prev
    })
  }, [article])

  if (!article) {
    return (
      <div className="max-w-xl mx-auto px-4 py-4">
        <div className="text-center text-sm text-muted-foreground py-20">Loading article…</div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/articles')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Avatar
              pubkey={article.author.pubkey}
              displayName={article.author.displayName ?? article.author.name}
              picture={article.author.picture}
              size={36}
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-snug">{article.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>{article.author.displayName ?? article.author.name ?? 'Anonymous'}</span>
                <span>·</span>
                <span>{formatTime(article.publishedAt)}</span>
                <span>·</span>
                <span>{article.readingTime} min read</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-4 w-4" />
              <ZapButton
                target={{ recipient: article.author.pubkey, profile: article.author, note: article.event }}
              />
            </div>
          </div>
          <div className="flex gap-1 mb-6">
            {article.tags.slice(0, 8).map((tag) => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
          <div className="prose prose-invert max-w-none">{article.event.content && <Markdown children={article.event.content} />}</div>
        </CardContent>
      </Card>

      {related.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">By the same author</h2>
          <div className="space-y-3">
            {related.map((a) => (
              <Card
                key={a.event.id}
                className="cursor-pointer hover:border-accent/50 transition-colors"
                onClick={() => navigate(`/articles/${a.event.id}`)}
              >
                <CardContent className="pt-3 pb-3">
                  <div className="flex gap-3">
                    <Avatar
                      pubkey={a.author.pubkey}
                      displayName={a.author.displayName ?? a.author.name}
                      picture={a.author.picture}
                      size={30}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(a.publishedAt)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
