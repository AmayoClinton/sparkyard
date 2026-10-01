const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

function polymod(values: number[]): number {
  let chk = 1
  for (const value of values) {
    const top = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ value
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GENERATOR[i]
    }
  }
  return chk
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = []
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5)
  out.push(0)
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31)
  return out
}

export interface Bech32Decoded {
  prefix: string
  words: number[]
}

export function bech32Decode(bech: string): Bech32Decoded | null {
  const lower = bech.toLowerCase()
  if (lower !== bech && bech.toUpperCase() !== bech) return null
  const separator = lower.lastIndexOf('1')
  if (separator < 1 || separator + 7 > lower.length) return null
  const prefix = lower.slice(0, separator)
  const words: number[] = []
  for (let i = separator + 1; i < lower.length; i++) {
    const index = CHARSET.indexOf(lower[i])
    if (index === -1) return null
    words.push(index)
  }
  if (polymod([...hrpExpand(prefix), ...words]) !== 1) return null
  return { prefix, words: words.slice(0, -6) }
}

function convertBits(data: number[], from: number, to: number, pad: boolean): Uint8Array | null {
  let acc = 0
  let bits = 0
  const out: number[] = []
  const maxv = (1 << to) - 1
  for (const value of data) {
    if (value < 0 || value >> from !== 0) return null
    acc = (acc << from) | value
    bits += from
    while (bits >= to) {
      bits -= to
      out.push((acc >> bits) & maxv)
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv)
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    return null
  }
  return Uint8Array.from(out)
}

export function bech32ToBytes(bech: string): Uint8Array | null {
  const decoded = bech32Decode(bech)
  if (!decoded) return null
  return convertBits(decoded.words, 5, 8, false)
}