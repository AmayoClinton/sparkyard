import * as React from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { relayPool } from '@/services/nostr'
import { getSigner } from '@/services/auth'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { type NostrEvent, type UserProfile } from '@/types/nostr'
import { parseProfileEvent } from '@/services/identity'
import { formatTime } from '@/lib/feed'
import { parseArticle, publishArticle } from '@/services/articles'

export const ArticlesPage: React.FC = () => {
  const navigate = useNavigate()
  const [articles, setArticles] = React.useState<ReturnType<typeof parseArticle>[]>([])
  const [profiles, setProfiles] = React.useState<Map<string, UserProfile>>(new Map())
  const [draftTitle, setDraftTitle] = React.useState('')
  const [draftContent, setDraftContent] = React.useState('')
  const [draftTags, setDraftTags] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    const unsub = relayPool.subscribe(
      [{ kinds: [30023], limit: 100 }],
      (event: NostrEvent) => {
        setArticles((prev) => {
          if (prev.some((a) => a.event.id === event.id)) return prev
          const author = profiles.get(event.pubkey) ?? { pubkey: event.pubkey }
          return [parseArticle(event, author), ...prev].sort(
            (a, b) => b.publishedAt - a.publishedAt
          )
        })
      }
    )
    return unsub
  }, [profiles])

  React.useEffect(() => {
    const unsub = relayPool.subscribe(
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
    return unsub
  }, [])

  const publish = async () => {
    if (!draftTitle.trim() || !draftContent.trim()) return
    setBusy(true)
    try {
      await publishArticle({
        title: draftTitle,
        content: draftContent,
        tags: draftTags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setDraftTitle('')
      setDraftContent('')
      setDraftTags('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to publish article')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Articles</h1>
      </div>

      {getSigner() && (
        <Card className="overflow-hidden">
          <CardContent className="pt-4 space-y-3">
            <textarea
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-transparent text-lg font-bold outline-none resize-none"
              maxLength={200}
            />
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Write your article in Markdown…"
              className="w-full min-h-[140px] bg-transparent outline-none resize-none"
            />
            <div className="flex gap-2">
              <Input
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="tags (comma separated)"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={publish}
                disabled={busy || !draftTitle.trim() || !draftContent.trim()}
              >
                {busy ? 'Publishing…' : (<><Plus className="h-4 w-4 mr-1" /> Publish</>)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {articles.map((article) => (
          <Card
            key={article.event.id}
            className="cursor-pointer hover:border-accent/50 transition-colors"
            onClick={() => navigate(`/articles/${article.event.id}`)}
          >
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Avatar
                  pubkey={article.author.pubkey}
                  displayName={article.author.displayName ?? article.author.name}
                  picture={article.author.picture}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-snug">{article.title}</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{article.author.displayName ?? article.author.name ?? 'Anonymous'}</span>
                    <span>·</span>
                    <span>{formatTime(article.publishedAt)}</span>
                    <span>·</span>
                    <span>{article.readingTime} min read</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {article.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {article.summary}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {articles.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No articles yet. Write the first one.
          </div>
        )}
      </div>
    </div>
  )
}
