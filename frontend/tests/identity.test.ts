import { describe, it, expect } from 'vitest'
import { getAvatarColor, getInitial } from '../src/services/identity'

describe('identity', () => {
  it('deterministic avatar color from pubkey', () => {
    const c1 = getAvatarColor('a1b2c3d4e5f6')
    const c2 = getAvatarColor('a1b2c3d4e5f6')
    expect(c1).toBe(c2)
  })

  it('initial from display name', () => {
    expect(getInitial('Alice', 'abc')).toBe('A')
  })

  it('initial fallback to pubkey', () => {
    expect(getInitial(undefined, 'abc')).toBe('A')
  })
})
