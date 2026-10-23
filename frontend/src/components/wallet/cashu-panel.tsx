import * as React from 'react'
import { ArrowDownLeft, ArrowUpRight, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  CURATED_MINTS,
  addStoredProofs,
  assertCuratedMint,
  createCashuToken,
  decodeCashuToken,
  encodeCashuToken,
  formatSats,
  loadStoredProofs,
  storeProofs,
  storedBalance,
  type StoredProof,
} from '@/services/cashu'

function pickProofs(proofs: StoredProof[], amount: number): StoredProof[] {
  const sorted = [...proofs].sort((a, b) => b.amount - a.amount)
  const picked: StoredProof[] = []
  let total = 0
  for (const proof of sorted) {
    if (total >= amount) break
    picked.push(proof)
    total += proof.amount
  }
  return total >= amount ? picked : []
}

export const CashuPanel: React.FC = () => {
  const [proofs, setProofs] = React.useState<StoredProof[]>([])
  const [tokenIn, setTokenIn] = React.useState('')
  const [sendAmount, setSendAmount] = React.useState('100')
  const [tokenOut, setTokenOut] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setProofs(loadStoredProofs())
  }, [])

  const receive = () => {
    setError('')
    setMessage('')
    try {
      const token = decodeCashuToken(tokenIn)
      for (const entry of token.token) assertCuratedMint(entry.mint)
      setProofs(addStoredProofs(token.token))
      setTokenIn('')
      setMessage(`Received ${formatSats(token.token.flatMap((e) => e.proofs).reduce((s, p) => s + p.amount, 0))} sats`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid Cashu token')
    }
  }

  const send = () => {
    setError('')
    setMessage('')
    setTokenOut('')
    try {
      const amount = Number(sendAmount)
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid amount')
      const picked = pickProofs(proofs, amount)
      if (picked.length === 0) throw new Error('Not enough balance')
      const mint = picked[0].mint
      const token = createCashuToken(
        mint,
        picked.map(({ mint: _mint, ...proof }) => proof)
      )
      setTokenOut(encodeCashuToken(token))
      const remaining = proofs.filter((proof) => !picked.includes(proof))
      storeProofs(remaining)
      setProofs(remaining)
      setMessage(`Created a ${formatSats(amount)} sat token. Copy it and send it to the recipient.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create token')
    }
  }

  return (
    <div className="space-y-3">
      <Card className="bg-accent/10 border-accent/20">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="h-4 w-4 text-accent" /> Ecash balance
          </div>
          <div className="text-3xl font-bold tracking-tight mt-1">
            {formatSats(storedBalance(proofs))} <span className="text-sm font-medium text-muted-foreground">sats</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {proofs.length} proof{proofs.length === 1 ? '' : 's'} · curated mints only
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ArrowDownLeft className="h-4 w-4 text-success" /> Receive
          </div>
          <Input
            value={tokenIn}
            onChange={(event) => setTokenIn(event.target.value)}
            placeholder="cashuA…"
          />
          <Button size="sm" onClick={receive} disabled={!tokenIn.trim()}>
            Redeem token
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ArrowUpRight className="h-4 w-4 text-accent" /> Send
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={sendAmount}
              onChange={(event) => setSendAmount(event.target.value)}
            />
            <Button size="sm" onClick={send} disabled={proofs.length === 0}>
              Create token
            </Button>
          </div>
          {tokenOut && (
            <textarea
              readOnly
              value={tokenOut}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full h-20 bg-muted rounded-md p-2 text-[10px] font-mono break-all"
            />
          )}
        </CardContent>
      </Card>

      {message && <p className="text-xs text-success">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="text-[10px] text-muted-foreground">
        <div className="font-semibold mb-1">Curated mints</div>
        <ul className="space-y-0.5">
          {CURATED_MINTS.map((mint) => (
            <li key={mint} className="font-mono truncate">{mint}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}