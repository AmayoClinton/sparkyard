import * as React from 'react'
import { Bell, Radio, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { relayPool } from '@/services/nostr'
import {
  isPushEnabled,
  isSelfHostedEnabled,
  setPushEnabled,
  setSelfHostedEnabled,
} from '@/services/settings'
import { initPush, isPushSupported, notify, requestPushPermission } from '@/services/push'

export const SettingsPage: React.FC = () => {
  const [selfHosted, setSelfHosted] = React.useState(() => isSelfHostedEnabled())
  const [push, setPush] = React.useState(() => isPushEnabled())
  const [relays, setRelays] = React.useState<string[]>(() => relayPool.getConnectedRelays())
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    const timer = setInterval(() => setRelays(relayPool.getConnectedRelays()), 3000)
    return () => clearInterval(timer)
  }, [])

  React.useEffect(() => {
    if (isPushEnabled()) void initPush((message) => notify(message))
  }, [])

  const toggleSelfHosted = () => {
    const next = !selfHosted
    setSelfHosted(next)
    setSelfHostedEnabled(next)
    setRelays(relayPool.getConnectedRelays())
  }

  const togglePush = async () => {
    setError('')
    if (push) {
      setPush(false)
      setPushEnabled(false)
      return
    }
    if (!isPushSupported()) {
      setError('This browser does not support notifications.')
      return
    }
    const granted = await requestPushPermission()
    if (!granted) {
      setError('Notification permission was not granted.')
      return
    }
    await initPush((message) => notify(message))
    setPush(true)
    setPushEnabled(true)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-accent" /> Self-hosted relay
            </div>
            <Button size="sm" variant={selfHosted ? 'default' : 'outline'} onClick={toggleSelfHosted}>
              {selfHosted ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Adds <code>ws://localhost:8081</code> to the relay pool so you can run your own relay alongside public ones.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-accent" /> Push notifications
            </div>
            <Button size="sm" variant={push ? 'default' : 'outline'} onClick={togglePush}>
              {push ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Alerts for incoming DMs and mentions. Uses the browser Notification API, or the Capacitor push plugin when
            running as a native app.
          </p>
          {push && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => notify({ title: 'Sparkyard', body: 'Push notifications are working.' })}
            >
              Send test notification
            </Button>
          )}
          {error && <p className="text-destructive text-xs">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="h-4 w-4 text-accent" /> Connected relays
          </div>
          {relays.length === 0 && <div className="text-xs text-muted-foreground">No relays connected yet.</div>}
          {relays.map((url) => (
            <div key={url} className="text-xs font-mono text-muted-foreground truncate">
              {url}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}