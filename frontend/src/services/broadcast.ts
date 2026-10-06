import { type NostrFilter } from '@/types/nostr'

export function normalizeGroupId(input: string): string {
  let id = input.trim()
  try {
    id = decodeURIComponent(id)
  } catch {
    /* keep raw value */
  }
  return id
}

export function isValidGroupId(input: string): boolean {
  const id = normalizeGroupId(input)
  return id.length > 0 && id.length <= 100 && /^[a-zA-Z0-9._:-]+$/.test(id)
}

export function broadcastFilter(groupId: string, limit = 50): NostrFilter {
  return { kinds: [9], '#h': [normalizeGroupId(groupId)], limit }
}