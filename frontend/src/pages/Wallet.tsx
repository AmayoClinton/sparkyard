import * as React from 'react'
import { Link } from 'react-router-dom'
import { Coins, LayoutGrid, Wallet, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { NwcPanel } from '@/components/wallet/nwc-panel'
import { CashuPanel } from '@/components/wallet/cashu-panel'
import { ZapsPanel } from '@/components/wallet/zaps-panel'
import { getSigner } from '@/services/auth'

type Tab = 'nwc' | 'cashu' | 'zaps'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'nwc', label: 'Lightning', icon: Zap },
  { id: 'cashu', label: 'Cashu', icon: Coins },
  { id: 'zaps', label: 'Zaps', icon: Wallet },
]

export const WalletPage: React.FC = () => {
  const [tab, setTab] = React.useState<Tab>('nwc')
  const [pubkey, setPubkey] = React.useState<string | null>(null)

  React.useEffect(() => {
    const signer = getSigner()
    if (!signer) return
    signer
      .getPublicKey()
      .then(setPubkey)
      .catch(() => setPubkey(null))
  }, [])

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Wallet</h1>
        <Link
          to="/widgets"
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Smart Widgets
        </Link>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-xs transition-colors ${
              tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'nwc' && <NwcPanel />}
      {tab === 'cashu' && <CashuPanel />}
      {tab === 'zaps' && <ZapsPanel pubkey={pubkey} />}

      <Card>
        <CardContent className="pt-4">
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            Zaps use NIP-57 over LNURL-pay. NWC uses NIP-47 with AES-GCM encrypted connection secrets. Cashu uses a
            curated mint allowlist only. Smart Widgets render in a sandboxed iframe with an opaque origin.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}