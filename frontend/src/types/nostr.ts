export interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

export interface PublishResult {
  url: string
  accepted: boolean
  reason: string
}

export interface NostrFilter {
  ids?: string[]
  authors?: string[]
  kinds?: number[]
  since?: number
  until?: number
  limit?: number
  '#e'?: string[]
  '#p'?: string[]
  '#t'?: string[]
  [key: `#${string}`]: string[] | undefined
}

export interface RelayConfig {
  url: string
  read: boolean
  write: boolean
}

export interface UserProfile {
  pubkey: string
  displayName?: string
  name?: string
  picture?: string
  about?: string
  nip05?: string
  lud16?: string
  lud06?: string
}

export interface FeedItem {
  event: NostrEvent
  author: UserProfile
  reactions: { count: number; userReacted: boolean }
  zaps: { amount: number; count: number }
  replies: number
  reposts: number
  votes: { up: number; down: number; userVote: 'up' | 'down' | null }
}

export interface Article {
  event: NostrEvent
  author: UserProfile
  title: string
  summary?: string
  image?: string
  publishedAt: number
  tags: string[]
  readingTime?: number
}

export interface ArticleDetail extends Article {
  content: string
  replies: number
  reposts: number
  zaps: { amount: number; count: number }
}

export interface ThreadNode {
  event: NostrEvent
  author: UserProfile
  replies: ThreadNode[]
  depth: number
}

export interface Story {
  event: NostrEvent
  author: UserProfile
  expiresAt: number
}

export type SortMode = 'hot' | 'new' | 'top'

export type ThemeMode = 'light' | 'dark' | 'black' | 'system'
