import * as React from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { relayPool } from '@/services/nostr'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { WidgetFrame } from '@/components/widgets/widget-frame'
import { isWidgetAllowed, MIN_WIDGET_REPUTATION, parseWidget, type Widget } from '@/services/widgets'
import { type NostrEvent } from '@/types/nostr'
import { formatTime } from '@/lib/feed'

export const WidgetsPage: React.FC = () => {
  const [widgets, setWidgets] = React.useState<Widget[]>([])

  React.useEffect(() => {
    const unsub = relayPool.subscribe([{ kinds: [30033], limit: 100 }], (event: NostrEvent) => {
      const widget = parseWidget(event)
      if (!widget) return
      setWidgets((prev) => {
        if (prev.some((item) => item.id === widget.id && item.author === widget.author)) return prev
        return [widget, ...prev]
      })
    })
    return unsub
  }, [])

  const allowed = widgets.filter((widget) => isWidgetAllowed(widget))
  const locked = widgets.filter((widget) => !isWidgetAllowed(widget))

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold">Smart Widgets</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        Widgets are kind 30033 apps rendered in a sandboxed iframe. Only <code>allow-scripts</code> is granted, so the
        frame runs on an opaque origin and cannot read app storage or cookies. Authors below reputation{' '}
        {MIN_WIDGET_REPUTATION} stay locked.
      </p>

      {allowed.map((widget) => (
        <Card key={`${widget.author}:${widget.id}`} className="overflow-hidden">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{widget.title}</CardTitle>
              <span className="text-[10px] text-muted-foreground">{formatTime(widget.createdAt)}</span>
            </div>
            <WidgetFrame widget={widget} />
            {widget.summary && <p className="text-xs text-muted-foreground">{widget.summary}</p>}
          </CardContent>
        </Card>
      ))}

      {locked.map((widget) => (
        <Card key={`${widget.author}:${widget.id}`} className="opacity-70">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{widget.title}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Blocked by reputation gate ({widget.reputation}/{MIN_WIDGET_REPUTATION}).
            </p>
          </CardContent>
        </Card>
      ))}

      {widgets.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-10">
          No widgets discovered yet. Publish a kind 30033 event with an <code>url</code> tag to list one.
        </div>
      )}
    </div>
  )
}