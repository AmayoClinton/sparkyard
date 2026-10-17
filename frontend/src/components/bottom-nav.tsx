import * as React from 'react'
import { Home, Server, MessageCircle, Wallet, FileText } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV = [
  { path: '/', icon: Home, label: 'Feed' },
  { path: '/servers', icon: Server, label: 'Servers' },
  { path: '/articles', icon: FileText, label: 'Articles' },
  { path: '/messages', icon: MessageCircle, label: 'Messages' },
  { path: '/wallet', icon: Wallet, label: 'Wallet' },
]

export const BottomNav: React.FC = () => {
  const location = useLocation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-lg safe-area-pb">
      <div className="max-w-xl mx-auto flex items-center justify-around h-14">
        {NAV.map((item) => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full gap-0.5 text-xs transition-colors',
                active ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
