import * as React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { AuthModal } from '@/components/auth-modal'
import { ThemeToggle } from '@/components/theme-toggle'
import { FeedPage } from '@/pages/Feed'
import { ServersPage } from '@/pages/Servers'
import { ServerDetailPage } from '@/pages/ServerDetail'
import { ArticlesPage } from '@/pages/Articles'
import { ArticleDetailPage } from '@/pages/ArticleDetail'
import { ThreadViewPage } from '@/pages/ThreadView'
import { MessagesPage } from '@/pages/Messages'
import { WalletPage } from '@/pages/Wallet'
import { WidgetsPage } from '@/pages/Widgets'
import { BroadcastPage } from '@/pages/Broadcast'
import { SettingsPage } from '@/pages/Settings'
import { Button } from '@/components/ui/button'
import { isLoggedIn, logout } from '@/services/auth'
import { Avatar } from '@/components/avatar'

export default function App() {
  const [loggedIn, setLoggedIn] = React.useState(isLoggedIn)
  const [showAuth, setShowAuth] = React.useState(false)
  const [pubkey, setPubkey] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLoggedIn(isLoggedIn())
  }, [])

  const handleLogin = (pk: string) => {
    setPubkey(pk)
    setLoggedIn(true)
  }

  const handleLogout = () => {
    logout()
    setLoggedIn(false)
    setPubkey(null)
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground pb-16">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-sm">S</span>
              </div>
              <h1 className="font-bold text-lg tracking-tight">Sparkyard</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/settings"
                title="Settings"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <ThemeToggle />
              {loggedIn ? (
                <div className="flex items-center gap-2">
                  {pubkey && <Avatar pubkey={pubkey} size={32} />}
                  <Button size="sm" variant="ghost" onClick={handleLogout}>Log out</Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setShowAuth(true)}>Sign in</Button>
              )}
            </div>
          </div>
        </header>

        <main className="py-2">
          <Routes>
            <Route path="/" element={<FeedPage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/servers/:groupId" element={<ServerDetailPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />
            <Route path="/notes/:eventId" element={<ThreadViewPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:pubkey" element={<MessagesPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/widgets" element={<WidgetsPage />} />
            <Route path="/broadcast" element={<BroadcastPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>

        <BottomNav />
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} onLogin={handleLogin} />
      </div>
    </BrowserRouter>
  )
}
