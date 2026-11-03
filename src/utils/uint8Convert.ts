export const uint32ToUint8 = (n: number): Uint8Array => {
  let num = n
  const res = new Uint8Array(4)
  for (let i = 0; i < 4; i++) {
    res[3 - i] = num & 0xff
    num >>= 8
  }
  return res
}

export const uint8ToUint32 = (n: Uint8Array): number => {
  let num = 0
  for (let i = 0; i < 4; i++) {
    num <<= 8
    num |= n[i] ?? 0
  }
  return num
}

export const uint64ToUint8 = (n: number): Uint8Array => {
  let num = n
  const res = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    res[7 - i] = num & 0xff
    num >>= 8
  }
  return res
}

export const uint8ToUint64 = (n: Uint8Array): number => {
  let num = 0
  for (let i = 0; i < 8; i++) {
    num <<= 8
    num |= n[i] ?? 0
  }
  return num
}

export const strToUint8 = (s: string): Uint8Array => {
  const res = new TextEncoder().encode(s)
  return res
}

export const uint8ToStr = (n: Uint8Array): string => {
  const res = new TextDecoder('utf-8').decode(n)
  return res
}
