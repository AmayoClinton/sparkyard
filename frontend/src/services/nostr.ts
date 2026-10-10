import { type NostrEvent, type NostrFilter, type RelayConfig, type PublishResult } from '@/types/nostr'

function configuredRelays(): RelayConfig[] {
  const configured = import.meta.env.VITE_RELAY_URLS as string | undefined
  if (configured) {
    return configured
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.startsWith('ws://') || url.startsWith('wss://'))
      .map((url) => ({ url, read: true, write: true }))
  }
  return [
    { url: 'wss://relay.damus.io', read: true, write: true },
    { url: 'wss://relay.nostr.band', read: true, write: false },
    { url: 'wss://nos.lol', read: true, write: true },
  ]
}

export const DEFAULT_RELAYS: RelayConfig[] = (() => {
  const relays = configuredRelays()
  const local = import.meta.env.VITE_LOCAL_RELAY as string | undefined
  if (local && !relays.some((relay) => relay.url === local)) {
    relays.push({ url: local, read: true, write: true })
  }
  return relays
})()

interface Subscription {
  id: string
  filters: NostrFilter[]
  onEvent: (event: NostrEvent) => void
  onEose?: () => void
}

class RelayPool {
  private relays = new Map<string, WebSocket>()
  private subs = new Map<string, Subscription>()
  private subCounter = 0
  private pending = new Map<string, Set<string>>() // url -> subIds
  private disabled = new Set<string>()

  constructor() {
    this.connectAll()
  }

  private connectAll() {
    for (const cfg of DEFAULT_RELAYS) {
      this.connect(cfg.url)
    }
  }

  private connect(url: string) {
    if (this.relays.has(url) || this.disabled.has(url)) return
    const ws = new WebSocket(url)
    this.relays.set(url, ws)
    this.pending.set(url, new Set())

    ws.onopen = () => {
      console.log('[relay] connected', url)
      // Resubscribe existing subs to this relay
      for (const sub of this.subs.values()) {
        this.sendSub(ws, sub)
      }
    }

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        if (data[0] === 'EVENT' && data.length >= 3) {
          const subId = data[1]
          const event: NostrEvent = data[2]
          const sub = this.subs.get(subId)
          sub?.onEvent(event)
        } else if (data[0] === 'EOSE' && data.length >= 2) {
          const subId = data[1]
          const sub = this.subs.get(subId)
          sub?.onEose?.()
        }
      } catch (e) {
        console.warn('[relay] parse error', e)
      }
    }

    ws.onclose = () => {
      console.log('[relay] disconnected', url)
      this.relays.delete(url)
      if (this.disabled.has(url)) return
      // Exponential backoff reconnect
      setTimeout(() => this.connect(url), 5000)
    }

    ws.onerror = (err) => {
      console.warn('[relay] error', url, err)
    }
  }

  addRelay(url: string): void {
    if (!url || this.relays.has(url)) return
    this.disabled.delete(url)
    this.connect(url)
  }

  removeRelay(url: string): void {
    if (!url) return
    this.disabled.add(url)
    const ws = this.relays.get(url)
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      try {
        ws.close()
      } catch {
        /* already closed */
      }
      this.relays.delete(url)
    }
    this.pending.delete(url)
  }

  private sendSub(ws: WebSocket, sub: Subscription) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(['REQ', sub.id, ...sub.filters]))
    }
  }

  subscribe(filters: NostrFilter[], onEvent: (event: NostrEvent) => void, onEose?: () => void): () => void {
    const id = `sub_${++this.subCounter}_${Math.random().toString(36).slice(2, 8)}`
    const sub: Subscription = { id, filters, onEvent, onEose }
    this.subs.set(id, sub)

    for (const ws of this.relays.values()) {
      this.sendSub(ws, sub)
    }

    return () => {
      this.subs.delete(id)
      for (const ws of this.relays.values()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', id]))
        }
      }
    }
  }

  async publish(event: NostrEvent): Promise<PublishResult[]> {
    const results: PublishResult[] = []
    const promises: Promise<void>[] = []
    for (const [url, ws] of this.relays.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        promises.push(
          new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              results.push({ url, accepted: false, reason: 'timeout' })
              resolve()
            }, 10000)
            const handler = (msg: MessageEvent) => {
              try {
                const data = JSON.parse(msg.data)
                if (data[0] === 'OK' && data[1] === event.id) {
                  ws.removeEventListener('message', handler)
                  clearTimeout(timeout)
                  results.push({
                    url,
                    accepted: data[2] === true,
                    reason: data[2] === true ? '' : (data[3] || 'rejected'),
                  })
                  resolve()
                }
              } catch { /* ignore */ }
            }
            ws.addEventListener('message', handler)
            ws.send(JSON.stringify(['EVENT', event]))
          })
        )
      }
    }
    await Promise.allSettled(promises)
    return results
  }

  getConnectedRelays(): string[] {
    return Array.from(this.relays.entries())
      .filter(([, ws]) => ws.readyState === WebSocket.OPEN)
      .map(([url]) => url)
  }
}

export const relayPool = new RelayPool()
