import * as React from 'react'
import { Plug, RefreshCw, Unplug, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  clearNwcSession,
  connectNwc,
  loadNwcSession,
  nwcGetBalance,
  nwcGetInfo,
  type NwcSession,
} from '@/services/nwc'
import { formatSats } from '@/services/cashu'

export const NwcPanel: React.FC = () => {
  const [session, setSession] = React.useState<NwcSession | null>(null)
  const [uri, setUri] = React.useState('')
  const [balance, setBalance] = React.useState<number | null>(null)
  const [info, setInfo] = React.useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    void loadNwcSession().then(setSession)
  }, [])

  React.useEffect(() => {
    if (!session) return
    setBusy(true)
    Promise.all([nwcGetBalance(session), nwcGetInfo(session)])
      .then(([msats, walletInfo]) => {
        setBalance(msats)
        setInfo(walletInfo)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'NWC request failed'))
      .finally(() => setBusy(false))
  }, [session])

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      const next = await connectNwc(uri)
      setSession(next)
      setUri('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect wallet')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = () => {
    clearNwcSession()
    setSession(null)
    setBalance(null)
    setInfo(null)
  }

  if (session) {
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-accent" /> NWC wallet connected
            </div>
            <Button size="sm" variant="ghost" onClick={disconnect}>
              <Unplug className="h-4 w-4 mr-1" /> Disconnect
            </Button>
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {balance === null ? '—' : formatSats(Math.floor(balance / 1000))}{' '}
            <span className="text-sm font-medium text-muted-foreground">sats</span>
          </div>
          <div className="text-xs text-muted-foreground font-mono break-all">{session.walletPubkey.slice(0, 16)}…</div>
          {info && (
            <div className="text-xs text-muted-foreground space-y-1">
              {typeof info.methods === 'object' && (
                <div>Methods: {(info.methods as string[]).join(', ')}</div>
              )}
              {typeof info.name === 'string' && <div>Wallet: {info.name}</div>}
            </div>
          )}
          {busy && <div className="text-xs text-muted-foreground">Refreshing balance…</div>}
          {error && <p className="text-destructive text-xs">{error}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Plug className="h-4 w-4 text-accent" /> Connect a NWC wallet
        </div>
        <p className="text-xs text-muted-foreground">
          Paste a <code>nostr+walletconnect://…</code> connection string. It is encrypted with AES-GCM before it is
          stored — never kept in plaintext.
        </p>
        <Input
          type="password"
          value={uri}
          onChange={(event) => setUri(event.target.value)}
          placeholder="nostr+walletconnect://…"
          autoComplete="off"
        />
        {error && <p className="text-destructive text-xs">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setUri('')} disabled={!uri}>
            <RefreshCw className="h-4 w-4 mr-1" /> Clear
          </Button>
          <Button size="sm" onClick={connect} disabled={busy || !uri.trim()}>
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}