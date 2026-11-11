import { describe, it, expect } from 'vitest'
import {
  formatDirectMessageNotification,
  isMention,
  isPushSupported,
} from '../src/services/push'

const pubkey = 'a'.repeat(64)

describe('push notifications', () => {
  it('formats a DM notification', () => {
    const message = formatDirectMessageNotification(pubkey, 'hello')
    expect(message.title).toContain('New message')
    expect(message.body).toBe('hello')
    expect(message.tag).toBe(`dm:${pubkey}`)
  })

  it('truncates long DM bodies', () => {
    const message = formatDirectMessageNotification(pubkey, 'x'.repeat(200))
    expect(message.body.length).toBe(118)
    expect(message.body.endsWith('…')).toBe(true)
  })

  it('detects nostr mentions', () => {
    expect(isMention(`hey nostr:${pubkey}`, pubkey)).toBe(true)
    expect(isMention(`hey #${pubkey.slice(0, 8)}`, pubkey)).toBe(true)
    expect(isMention('hello world', pubkey)).toBe(false)
  })

  it('reports no browser push support outside a browser', () => {
    expect(isPushSupported()).toBe(false)
  })
})