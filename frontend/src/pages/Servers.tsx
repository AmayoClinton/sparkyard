import * as React from 'react'
import { Link } from 'react-router-dom'
import { Server, Hash, Users, Plus, UserPlus, Radio } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { relayPool } from '@/services/nostr'
import { isLoggedIn } from '@/services/auth'
import { type NostrEvent } from '@/types/nostr'
import { createGroup, joinGroup } from '@/services/groups'

interface GroupMeta {
  id: string
  name: string
  description: string
  picture?: string
  members: number
}

function parseGroupMeta(event: NostrEvent): GroupMeta {
  const meta: GroupMeta = { id: '', name: 'Unnamed Group', description: '', members: 0 }
  for (const tag of event.tags) {
    if (tag.length >= 2) {
      switch (tag[0]) {
        case 'h': meta.id = tag[1]; break
        case 'name': meta.name = tag[1]; break
        case 'description': meta.description = tag[1]; break
        case 'picture': meta.picture = tag[1]; break
      }
    }
  }
  if (meta.name === 'Unnamed Group' && event.content) {
    try {
      const parsed = JSON.parse(event.content)
      if (parsed.name) meta.name = parsed.name
      if (parsed.description) meta.description = parsed.description
      if (parsed.picture) meta.picture = parsed.picture
    } catch { /* ignore */ }
  }
  return meta
}

export const ServersPage: React.FC = () => {
  const [groups, setGroups] = React.useState<Map<string, GroupMeta>>(new Map())
  const [busy, setBusy] = React.useState<string | null>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    const unsub = relayPool.subscribe(
      [{ kinds: [39000], limit: 100 }],
      (event: NostrEvent) => {
        setGroups((prev) => {
          const meta = parseGroupMeta(event)
          if (!meta.id) return prev
          const next = new Map(prev)
          next.set(meta.id, { ...meta, members: next.get(meta.id)?.members || 0 })
          return next
        })
      }
    )
    return unsub
  }, [])

  const handleCreate = async () => {
    if (!isLoggedIn()) {
      alert('Sign in to create a server.')
      return
    }
    const id = prompt('Unique group ID (lowercase, no spaces):')?.trim()
    if (!id) return
    const name = prompt('Server name:')?.trim() || id
    const description = prompt('Description (optional):')?.trim() || ''
    setBusy(`create:${id}`)
    try {
      await createGroup(id, name, description)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create server')
    } finally {
      setBusy(null)
    }
  }

  const handleJoin = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation()
    if (!isLoggedIn()) {
      alert('Sign in to join a server.')
      return
    }
    setBusy(`join:${groupId}`)
    try {
      await joinGroup(groupId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to join server')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Servers</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/broadcast"
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Radio className="h-3.5 w-3.5" /> Broadcast
          </Link>
          <Button size="sm" onClick={handleCreate} disabled={!!busy}>
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {Array.from(groups.values()).map((group) => (
          <Card
            key={group.id}
            className="cursor-pointer hover:border-accent/50 transition-colors"
            onClick={() => navigate(`/servers/${encodeURIComponent(group.id)}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-accent" />
                  <CardTitle className="text-base">{group.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {group.members || '—'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{group.description || 'No description'}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs flex items-center gap-1 text-muted-foreground">
                  <Hash className="h-3 w-3" /> {group.id}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => handleJoin(e, group.id)}
                  disabled={busy === `join:${group.id}`}
                >
                  <UserPlus className="h-4 w-4 mr-1" /> Join
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {groups.size === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No servers discovered yet. Create one or wait for relays to sync.
          </div>
        )}
      </div>
    </div>
  )
}
