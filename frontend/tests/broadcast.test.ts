import { describe, it, expect } from 'vitest'
import { broadcastFilter, isValidGroupId, normalizeGroupId } from '../src/services/broadcast'

describe('broadcast channels', () => {
  it('builds a read-only kind 9 filter', () => {
    expect(broadcastFilter('bitcoin')).toEqual({ kinds: [9], '#h': ['bitcoin'], limit: 50 })
    expect(broadcastFilter('bitcoin', 10).limit).toBe(10)
  })

  it('normalizes encoded group ids', () => {
    expect(normalizeGroupId('my%20group')).toBe('my group')
    expect(normalizeGroupId('  bitcoin  ')).toBe('bitcoin')
  })

  it('validates group ids', () => {
    expect(isValidGroupId('bitcoin')).toBe(true)
    expect(isValidGroupId('my-group_1')).toBe(true)
    expect(isValidGroupId('')).toBe(false)
    expect(isValidGroupId('bad id')).toBe(false)
    expect(isValidGroupId('x'.repeat(101))).toBe(false)
  })
})