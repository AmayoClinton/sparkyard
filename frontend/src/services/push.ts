export interface PushMessage {
  title: string
  body: string
  tag?: string
}

type PushListener = (message: PushMessage) => void

interface CapacitorPushPlugin {
  register?: () => Promise<unknown>
  requestPermissions?: () => Promise<{ receive?: string }>
  addListener?: (event: string, callback: (notification: { title?: string; body?: string }) => void) => Promise<unknown>
}

function getPlugin(): CapacitorPushPlugin | undefined {
  const capacitor = (window as unknown as {
    Capacitor?: { Plugins?: { PushNotifications?: CapacitorPushPlugin } }
  }).Capacitor
  return capacitor?.Plugins?.PushNotifications
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return typeof Notification !== 'undefined' || !!getPlugin()
}

export async function requestPushPermission(): Promise<boolean> {
  const plugin = getPlugin()
  if (plugin?.requestPermissions) {
    const result = await plugin.requestPermissions()
    return result.receive === 'granted'
  }
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export async function initPush(onMessage: PushListener): Promise<boolean> {
  const plugin = getPlugin()
  if (plugin?.register && plugin?.addListener) {
    await plugin.register()
    await plugin.addListener('pushNotificationReceived', (notification) => {
      onMessage({ title: notification.title ?? 'Sparkyard', body: notification.body ?? '' })
    })
    return true
  }
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

export function notify(message: PushMessage): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (typeof document !== 'undefined' && !document.hidden) return
  new Notification(message.title, { body: message.body, tag: message.tag })
}

export function formatDirectMessageNotification(sender: string, content: string): PushMessage {
  const name = sender.slice(0, 8)
  const body = content.length > 120 ? content.slice(0, 117) + '…' : content
  return { title: `New message from ${name}…`, body, tag: `dm:${sender}` }
}

export function isMention(content: string, pubkey: string): boolean {
  return content.includes(`nostr:${pubkey}`) || content.includes(`#${pubkey.slice(0, 8)}`)
}