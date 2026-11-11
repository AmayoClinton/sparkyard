import { describe, it, expect, beforeEach, vi } from 'vitest'
import { decryptWithKey, encryptWithKey, generateAesKey, loadSecret, saveSecret } from '../src/services/secret-store'

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
})

describe('secret store', () => {
  it('encrypts and decrypts with AES-GCM', async () => {
    const key = await generateAesKey()
    const payload = await encryptWithKey(key, 'nostr+walletconnect://secret')
    expect(payload.data).not.toContain('walletconnect')
    expect(await decryptWithKey(key, payload)).toBe('nostr+walletconnect://secret')
  })

  it('fails to decrypt tampered payloads', async () => {
    const key = await generateAesKey()
    const payload = await encryptWithKey(key, 'value')
    const tampered = { ...payload, data: Buffer.from(payload.data, 'base64') }
    tampered.data[0] = tampered.data[0] ^ 0xff
    await expect(decryptWithKey(key, { ...payload, data: tampered.data.toString('base64') })).rejects.toBeTruthy()
  })

  it('persists secrets encrypted at rest', async () => {
    await saveSecret('nwc-secret', 'deadbeef')
    const raw = localStorage.getItem('sparkyard.secret.nwc-secret') ?? ''
    expect(raw).not.toContain('deadbeef')
    expect(await loadSecret('nwc-secret')).toBe('deadbeef')
  })

  it('returns null for missing secrets', async () => {
    expect(await loadSecret('missing')).toBeNull()
  })
})