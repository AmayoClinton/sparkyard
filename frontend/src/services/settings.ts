import { relayPool } from '@/services/nostr'

const SELF_HOSTED_KEY = 'sparkyard.self-hosted-relay'
const PUSH_KEY = 'sparkyard.push-enabled'

export const LOCAL_RELAY_URL =
  (import.meta.env.VITE_LOCAL_RELAY as string | undefined) || 'ws://localhost:8081'

export function isSelfHostedEnabled(): boolean {
  try {
    return localStorage.getItem(SELF_HOSTED_KEY) === '1'
  } catch {
    return false
  }
}

export function setSelfHostedEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(SELF_HOSTED_KEY, '1')
      relayPool.addRelay(LOCAL_RELAY_URL)
    } else {
      localStorage.removeItem(SELF_HOSTED_KEY)
      relayPool.removeRelay(LOCAL_RELAY_URL)
    }
  } catch {
    /* storage blocked */
  }
}

export function applyRelaySettings(): void {
  if (isSelfHostedEnabled()) relayPool.addRelay(LOCAL_RELAY_URL)
}

export function isPushEnabled(): boolean {
  try {
    return localStorage.getItem(PUSH_KEY) === '1'
  } catch {
    return false
  }
}

export function setPushEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(PUSH_KEY, '1')
    else localStorage.removeItem(PUSH_KEY)
  } catch {
    /* storage blocked */
  }
}