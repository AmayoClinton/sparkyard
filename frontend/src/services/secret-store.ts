const DB_NAME = 'sparkyard-secrets'
const STORE = 'keys'
const KEY_ID = 'device'
const PREFIX = 'sparkyard.secret.'

export interface EncryptedPayload {
  iv: string
  data: string
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

function idbGet(db: IDBDatabase): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(KEY_ID)
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed'))
  })
}

function idbPut(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(key, KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'))
  })
}

let memoryKey: CryptoKey | null = null

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function getDeviceKey(): Promise<CryptoKey> {
  if (memoryKey) return memoryKey
  try {
    const db = await openDb()
    const existing = await idbGet(db)
    if (existing) {
      memoryKey = existing
      return existing
    }
    const created = await generateAesKey()
    await idbPut(db, created)
    memoryKey = created
    return created
  } catch {
    if (!memoryKey) memoryKey = await generateAesKey()
    return memoryKey
  }
}

export async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, encoded as unknown as BufferSource)
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) }
}

export async function decryptWithKey(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const iv = fromBase64(payload.iv)
  const data = fromBase64(payload.data)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, data as unknown as BufferSource)
  return new TextDecoder().decode(plain)
}

export async function saveSecret(name: string, value: string): Promise<void> {
  const key = await getDeviceKey()
  const payload = await encryptWithKey(key, value)
  localStorage.setItem(PREFIX + name, JSON.stringify(payload))
}

export async function loadSecret(name: string): Promise<string | null> {
  const raw = localStorage.getItem(PREFIX + name)
  if (!raw) return null
  try {
    const key = await getDeviceKey()
    return await decryptWithKey(key, JSON.parse(raw) as EncryptedPayload)
  } catch {
    return null
  }
}

export function deleteSecret(name: string): void {
  localStorage.removeItem(PREFIX + name)
}

export async function hasSecret(name: string): Promise<boolean> {
  return localStorage.getItem(PREFIX + name) !== null
}