import * as React from 'react'
import { Zap, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchProfile } from '@/services/identity'
import { formatSats } from '@/services/cashu'
import { loadNwcSession, nwcPayInvoice } from '@/services/nwc'
import {
  payWithWebln,
  prepareZap,
  publishZapReceipt,
  requestInvoice,
  type ZapTarget,
} from '@/services/zaps'

interface ZapButtonProps {
  target: ZapTarget
  defaultAmount?: number
  className?: string
}

export const ZapButton: React.FC<ZapButtonProps> = ({ target, defaultAmount = 100, className }) => {
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState(String(defaultAmount))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [done, setDone] = React.useState('')

  const reset = () => {
    setError('')
    setDone('')
  }

  const send = async () => {
    setBusy(true)
    reset()
    try {
      const amountSats = Number(amount)
      if (!Number.isFinite(amountSats) || amountSats <= 0) throw new Error('Enter a valid amount')
      const profile = target.profile ?? (await fetchProfile(target.recipient))
      if (!profile.lud16 && !profile.lud06) throw new Error('This profile has no Lightning address')

      const plan = await prepareZap({ ...target, profile }, amountSats)
      const invoice = await requestInvoice(plan.pay, plan.amountMsats, plan.zapRequestJson)

      let preimage = ''
      const nwc = await loadNwcSession()
      if (nwc) preimage = await nwcPayInvoice(nwc, invoice.pr)
      else preimage = await payWithWebln(invoice.pr)

      await publishZapReceipt(plan.zapRequestJson, invoice.pr, preimage)
      setDone(`Zapped ${formatSats(amountSats)} sats`)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zap failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        className={`flex items-center gap-1 text-xs hover:text-accent transition-colors ${className ?? ''}`}
        onClick={(event) => {
          event.stopPropagation()
          reset()
          setOpen(true)
        }}
      >
        <Zap className="h-4 w-4" />
        {done || 'Zap'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Send a zap</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Zaps are Lightning payments signed as Nostr events. A receipt (kind 9735) is published after payment.
            </p>
            <label className="text-xs text-muted-foreground">Amount (sats)</label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 mb-3"
            />
            {error && <p className="text-destructive text-sm mb-3">{error}</p>}
            <Button className="w-full" onClick={send} disabled={busy}>
              <Zap className="h-4 w-4 mr-2" />
              {busy ? 'Paying invoice…' : `Zap ${formatSats(Number(amount) || 0)} sats`}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              Paid via WebLN, or your connected NWC wallet if configured.
            </p>
          </div>
        </div>
      )}
    </>
  )
}