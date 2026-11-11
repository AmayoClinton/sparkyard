import { describe, it, expect, beforeEach, vi } from 'vitest'

const relay = vi.hoisted(() => ({
  addRelay: vi.fn(),
  removeRelay: vi.fn(),
}))

vi.mock('@/services/nostr', () => ({ relayPool: relay }))

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
  removeItem(key: string): void {
    this.values.delete(key)
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  relay.addRelay.mockClear()
  relay.removeRelay.mockClear()
})

import {
  applyRelaySettings,
  isPushEnabled,
  isSelfHostedEnabled,
  LOCAL_RELAY_URL,
  setPushEnabled,
  setSelfHostedEnabled,
} from '../src/services/settings'

describe('settings', () => {
  it('enables and disables the self-hosted relay', () => {
    setSelfHostedEnabled(true)
    expect(isSelfHostedEnabled()).toBe(true)
    expect(relay.addRelay).toHaveBeenCalledWith(LOCAL_RELAY_URL)

    setSelfHostedEnabled(false)
    expect(isSelfHostedEnabled()).toBe(false)
    expect(relay.removeRelay).toHaveBeenCalledWith(LOCAL_RELAY_URL)
  })

  it('applies the stored relay setting on startup', () => {
    setSelfHostedEnabled(true)
    relay.addRelay.mockClear()
    applyRelaySettings()
    expect(relay.addRelay).toHaveBeenCalledWith(LOCAL_RELAY_URL)
  })

  it('persists the push preference', () => {
    expect(isPushEnabled()).toBe(false)
    setPushEnabled(true)
    expect(isPushEnabled()).toBe(true)
    setPushEnabled(false)
    expect(isPushEnabled()).toBe(false)
  })
})