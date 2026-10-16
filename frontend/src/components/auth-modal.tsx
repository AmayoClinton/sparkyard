import * as React from 'react'
import { Key, LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isNip07Available, connectNip07 } from '@/services/auth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onLogin: (pubkey: string) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onLogin }) => {
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  if (!open) return null

  const handleNip07 = async () => {
    setLoading(true)
    setError('')
    try {
      const pubkey = await connectNip07()
      onLogin(pubkey)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Connect Wallet</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Sign in with your Nostr identity. Your keys stay in your signer — Sparkyard never touches your nsec.
        </p>
        <div className="space-y-2">
          {isNip07Available() ? (
            <Button className="w-full" onClick={handleNip07} disabled={loading}>
              <Key className="h-4 w-4 mr-2" />
              {loading ? 'Connecting...' : 'Browser Extension (NIP-07)'}
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              No NIP-07 extension detected. Install Alby, nos2x, or similar.
            </div>
          )}
          <Button className="w-full" variant="outline" disabled>
            <LogIn className="h-4 w-4 mr-2" />
            Bunker Signer (NIP-46) — soon
          </Button>
        </div>
        {error && <p className="text-destructive text-sm mt-3">{error}</p>}
        <p className="text-[10px] text-muted-foreground mt-4 text-center">
          Self-custodial by default. No email, no password, no server lock-in.
        </p>
      </div>
    </div>
  )
}
