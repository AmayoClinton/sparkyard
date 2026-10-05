import { type NostrEvent } from '@/types/nostr'

export interface Signer {
  getPublicKey(): Promise<string>
  signEvent(event: NostrEvent): Promise<NostrEvent>
  nip44Encrypt?(plaintext: string, pubkey: string): Promise<string>
  nip44Decrypt?(ciphertext: string, pubkey: string): Promise<string>
}

interface Nip07Provider {
  getPublicKey(): Promise<string>
  signEvent(event: NostrEvent): Promise<NostrEvent>
  nip44?: {
    encrypt(plaintext: string, pubkey: string): Promise<string>
    decrypt(ciphertext: string, pubkey: string): Promise<string>
  }
}

interface NostrWindow {
  nostr?: Nip07Provider
}

function getWindow(): NostrWindow {
  return window as unknown as NostrWindow
}

class Nip07Signer implements Signer {
  async getPublicKey(): Promise<string> {
    const provider = getWindow().nostr
    if (!provider) throw new Error('NIP-07 provider not available')
    return provider.getPublicKey()
  }

  async signEvent(event: NostrEvent): Promise<NostrEvent> {
    const provider = getWindow().nostr
    if (!provider) throw new Error('NIP-07 provider not available')
    return provider.signEvent(event)
  }

  async nip44Encrypt(plaintext: string, pubkey: string): Promise<string> {
    const nip44 = getWindow().nostr?.nip44
    if (!nip44) throw new Error('This signer does not support NIP-44 encryption')
    return nip44.encrypt(plaintext, pubkey)
  }

  async nip44Decrypt(ciphertext: string, pubkey: string): Promise<string> {
    const nip44 = getWindow().nostr?.nip44
    if (!nip44) throw new Error('This signer does not support NIP-44 decryption')
    return nip44.decrypt(ciphertext, pubkey)
  }
}

class Nip46Signer implements Signer {
  async getPublicKey(): Promise<string> {
    throw new Error('NIP-46 bunker signer not implemented yet')
  }

  async signEvent(_event: NostrEvent): Promise<NostrEvent> {
    throw new Error('NIP-46 bunker signer not implemented yet')
  }

  async nip44Encrypt(_plaintext: string, _pubkey: string): Promise<string> {
    throw new Error('NIP-46 bunker signer does not support NIP-44 yet')
  }

  async nip44Decrypt(_ciphertext: string, _pubkey: string): Promise<string> {
    throw new Error('NIP-46 bunker signer does not support NIP-44 yet')
  }
}

let activeSigner: Signer | null = null

export function setActiveSigner(signer: Signer): void {
  activeSigner = signer
}

export function getSigner(): Signer | null {
  return activeSigner
}

export function isLoggedIn(): boolean {
  return activeSigner !== null
}

export function supportsNip44(signer: Signer | null = activeSigner): boolean {
  return !!signer?.nip44Encrypt && !!signer?.nip44Decrypt
}

export function logout(): void {
  activeSigner = null
}

export function isNip07Available(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as NostrWindow).nostr
}

export async function connectNip07(): Promise<string> {
  const signer = new Nip07Signer()
  const pubkey = await signer.getPublicKey()
  activeSigner = signer
  return pubkey
}

export async function connectNip46(_bunkerUrl: string): Promise<string> {
  const signer = new Nip46Signer()
  activeSigner = signer
  return signer.getPublicKey()
}