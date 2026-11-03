/** 写入越界模式：'truncate' 按位截断，'error' 越界抛错，'clamp' 钳制到取值范围边界 */
export type ByteAccessorTruncateMode = 'truncate' | 'error' | 'clamp'

/** 读取越界模式：'error' 越界抛错，'blank' 越界补 0，'fill' 越界补 1 */
export type ByteAccessorReadMode = 'error' | 'blank' | 'fill'

// #region ByteWriter
export class ByteWriter {
  #buffer: Uint8Array
  #pointer = 0
  #end = 0

  constructor(initialCapacity = 32) {
    this.#buffer = new Uint8Array(initialCapacity)
  }

  get pointer() {
    return this.#pointer
  }
  get byteLength() {
    return this.#end
  }
  get capacity() {
    return this.#buffer.length
  }

  // #region internal
  #ensureCapacity(extra: number) {
    const needed = this.#pointer + extra
    if (needed > this.#buffer.length) {
      let newSize = this.#buffer.length
      while (newSize < needed) newSize *= 2
      const newBuffer = new Uint8Array(newSize)
      newBuffer.set(this.#buffer)
      this.#buffer = newBuffer
    }
    if (needed > this.#end) this.#end = needed
  }

  #checkRange(value: number, min: number, max: number, mode: ByteAccessorTruncateMode) {
    if (value < min || value > max) {
      if (mode === 'error') throw new RangeError(`Value ${value} out of range [${min}, ${max}]`)
      if (mode === 'clamp') return value < min ? min : max
      return value & max
    }
    return value
  }

  #normalizeInt(
    value: number | bigint,
    min: bigint,
    max: bigint,
    mode: ByteAccessorTruncateMode,
    truncateMask = max,
  ): bigint {
    const bigintValue = BigInt(value)
    if (bigintValue < min || bigintValue > max) {
      if (mode === 'error')
        throw new RangeError(`Value ${bigintValue} out of range [${min}, ${max}]`)
      if (mode === 'clamp') return bigintValue < min ? min : max
      return bigintValue & truncateMask
    }
    return bigintValue
  }
  // #endregion internal

  // #region uint8 / byte
  writeUint8(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xffn, mode)
    this.#ensureCapacity(1)
    this.#buffer[this.#pointer++] = Number(v)
    return this
  }

  setUint8(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xffn, mode)
    this.#ensureCapacity(1)
    this.#buffer[this.#pointer] = Number(v)
    return this
  }

  writeByte = this.writeUint8
  setByte = this.setUint8
  // #endregion uint8 / byte

  // #region int8
  writeInt8(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x80n, 0x7fn, mode, 0xffn)
    this.#ensureCapacity(1)
    this.#buffer[this.#pointer++] = Number(bigintValue & 0xffn)
    return this
  }

  setInt8(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x80n, 0x7fn, mode, 0xffn)
    this.#ensureCapacity(1)
    this.#buffer[this.#pointer] = Number(bigintValue & 0xffn)
    return this
  }
  // #endregion int8

  // #region uint16LE
  writeUint16LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ffn, mode)
    this.#ensureCapacity(2)
    this.#buffer[this.#pointer++] = Number(v & 0xffn)
    this.#buffer[this.#pointer++] = Number((v >> 8n) & 0xffn)
    return this
  }

  setUint16LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ffn, mode)
    this.#ensureCapacity(2)
    this.#buffer[this.#pointer] = Number(v & 0xffn)
    this.#buffer[this.#pointer + 1] = Number((v >> 8n) & 0xffn)
    return this
  }
  // #endregion uint16LE

  // #region int16LE
  writeInt16LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000n, 0x7fffn, mode, 0xff_ffn)
    this.#ensureCapacity(2)
    const unsigned = bigintValue & 0xff_ffn
    this.#buffer[this.#pointer++] = Number(unsigned & 0xffn)
    this.#buffer[this.#pointer++] = Number((unsigned >> 8n) & 0xffn)
    return this
  }

  setInt16LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000n, 0x7fffn, mode, 0xff_ffn)
    this.#ensureCapacity(2)
    const unsigned = bigintValue & 0xff_ffn
    this.#buffer[this.#pointer] = Number(unsigned & 0xffn)
    this.#buffer[this.#pointer + 1] = Number((unsigned >> 8n) & 0xffn)
    return this
  }
  // #endregion int16LE

  // #region uint16BE
  writeUint16BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ffn, mode)
    this.#ensureCapacity(2)
    this.#buffer[this.#pointer++] = Number((v >> 8n) & 0xffn)
    this.#buffer[this.#pointer++] = Number(v & 0xffn)
    return this
  }

  setUint16BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ffn, mode)
    this.#ensureCapacity(2)
    this.#buffer[this.#pointer] = Number((v >> 8n) & 0xffn)
    this.#buffer[this.#pointer + 1] = Number(v & 0xffn)
    return this
  }
  // #endregion uint16BE

  // #region int16BE
  writeInt16BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000n, 0x7fffn, mode, 0xff_ffn)
    this.#ensureCapacity(2)
    const unsigned = bigintValue & 0xff_ffn
    this.#buffer[this.#pointer++] = Number((unsigned >> 8n) & 0xffn)
    this.#buffer[this.#pointer++] = Number(unsigned & 0xffn)
    return this
  }

  setInt16BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000n, 0x7fffn, mode, 0xff_ffn)
    this.#ensureCapacity(2)
    const unsigned = bigintValue & 0xff_ffn
    this.#buffer[this.#pointer] = Number((unsigned >> 8n) & 0xffn)
    this.#buffer[this.#pointer + 1] = Number(unsigned & 0xffn)
    return this
  }
  // #endregion int16BE

  // #region uint32LE
  writeUint32LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ff_ff_ffn, mode)
    this.#ensureCapacity(4)
    this.#buffer[this.#pointer++] = Number(v & 0xffn)
    this.#buffer[this.#pointer++] = Number((v >> 8n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((v >> 16n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((v >> 24n) & 0xffn)
    return this
  }

  setUint32LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ff_ff_ffn, mode)
    this.#ensureCapacity(4)
    this.#buffer[this.#pointer] = Number(v & 0xffn)
    this.#buffer[this.#pointer + 1] = Number((v >> 8n) & 0xffn)
    this.#buffer[this.#pointer + 2] = Number((v >> 16n) & 0xffn)
    this.#buffer[this.#pointer + 3] = Number((v >> 24n) & 0xffn)
    return this
  }
  // #endregion uint32LE

  // #region int32LE
  writeInt32LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000_0000n, 0x7fff_ffffn, mode, 0xff_ff_ff_ffn)
    this.#ensureCapacity(4)
    const unsigned = bigintValue & 0xff_ff_ff_ffn
    this.#buffer[this.#pointer++] = Number(unsigned & 0xffn)
    this.#buffer[this.#pointer++] = Number((unsigned >> 8n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((unsigned >> 16n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((unsigned >> 24n) & 0xffn)
    return this
  }

  setInt32LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000_0000n, 0x7fff_ffffn, mode, 0xff_ff_ff_ffn)
    this.#ensureCapacity(4)
    const unsigned = bigintValue & 0xff_ff_ff_ffn
    this.#buffer[this.#pointer] = Number(unsigned & 0xffn)
    this.#buffer[this.#pointer + 1] = Number((unsigned >> 8n) & 0xffn)
    this.#buffer[this.#pointer + 2] = Number((unsigned >> 16n) & 0xffn)
    this.#buffer[this.#pointer + 3] = Number((unsigned >> 24n) & 0xffn)
    return this
  }
  // #endregion int32LE

  // #region uint32BE
  writeUint32BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ff_ff_ffn, mode)
    this.#ensureCapacity(4)
    this.#buffer[this.#pointer++] = Number((v >> 24n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((v >> 16n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((v >> 8n) & 0xffn)
    this.#buffer[this.#pointer++] = Number(v & 0xffn)
    return this
  }

  setUint32BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const v = this.#normalizeInt(value, 0n, 0xff_ff_ff_ffn, mode)
    this.#ensureCapacity(4)
    this.#buffer[this.#pointer] = Number((v >> 24n) & 0xffn)
    this.#buffer[this.#pointer + 1] = Number((v >> 16n) & 0xffn)
    this.#buffer[this.#pointer + 2] = Number((v >> 8n) & 0xffn)
    this.#buffer[this.#pointer + 3] = Number(v & 0xffn)
    return this
  }
  // #endregion uint32BE

  // #region int32BE
  writeInt32BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000_0000n, 0x7fff_ffffn, mode, 0xff_ff_ff_ffn)
    this.#ensureCapacity(4)
    const unsigned = bigintValue & 0xff_ff_ff_ffn
    this.#buffer[this.#pointer++] = Number((unsigned >> 24n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((unsigned >> 16n) & 0xffn)
    this.#buffer[this.#pointer++] = Number((unsigned >> 8n) & 0xffn)
    this.#buffer[this.#pointer++] = Number(unsigned & 0xffn)
    return this
  }

  setInt32BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, -0x8000_0000n, 0x7fff_ffffn, mode, 0xff_ff_ff_ffn)
    this.#ensureCapacity(4)
    const unsigned = bigintValue & 0xff_ff_ff_ffn
    this.#buffer[this.#pointer] = Number((unsigned >> 24n) & 0xffn)
    this.#buffer[this.#pointer + 1] = Number((unsigned >> 16n) & 0xffn)
    this.#buffer[this.#pointer + 2] = Number((unsigned >> 8n) & 0xffn)
    this.#buffer[this.#pointer + 3] = Number(unsigned & 0xffn)
    return this
  }
  // #endregion int32BE

  // #region uint64LE
  writeUint64LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, 0n, 0xffff_ffff_ffff_ffffn, mode)
    this.#ensureCapacity(8)
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer++] = Number((bigintValue >> BigInt(i * 8)) & 0xffn)
    }
    return this
  }

  setUint64LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, 0n, 0xffff_ffff_ffff_ffffn, mode)
    this.#ensureCapacity(8)
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer + i] = Number((bigintValue >> BigInt(i * 8)) & 0xffn)
    }
    return this
  }
  // #endregion uint64LE

  // #region int64LE
  writeInt64LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(
      value,
      -0x8000_0000_0000_0000n,
      0x7fff_ffff_ffff_ffffn,
      mode,
      0xffff_ffff_ffff_ffffn,
    )
    this.#ensureCapacity(8)
    const unsigned = bigintValue & 0xffff_ffff_ffff_ffffn
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer++] = Number((unsigned >> BigInt(i * 8)) & 0xffn)
    }
    return this
  }

  setInt64LE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(
      value,
      -0x8000_0000_0000_0000n,
      0x7fff_ffff_ffff_ffffn,
      mode,
      0xffff_ffff_ffff_ffffn,
    )
    this.#ensureCapacity(8)
    const unsigned = bigintValue & 0xffff_ffff_ffff_ffffn
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer + i] = Number((unsigned >> BigInt(i * 8)) & 0xffn)
    }
    return this
  }
  // #endregion int64LE

  // #region uint64BE
  writeUint64BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, 0n, 0xffff_ffff_ffff_ffffn, mode)
    this.#ensureCapacity(8)
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer++] = Number((bigintValue >> BigInt((7 - i) * 8)) & 0xffn)
    }
    return this
  }

  setUint64BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(value, 0n, 0xffff_ffff_ffff_ffffn, mode)
    this.#ensureCapacity(8)
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer + i] = Number((bigintValue >> BigInt((7 - i) * 8)) & 0xffn)
    }
    return this
  }
  // #endregion uint64BE

  // #region int64BE
  writeInt64BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(
      value,
      -0x8000_0000_0000_0000n,
      0x7fff_ffff_ffff_ffffn,
      mode,
      0xffff_ffff_ffff_ffffn,
    )
    this.#ensureCapacity(8)
    const unsigned = bigintValue & 0xffff_ffff_ffff_ffffn
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer++] = Number((unsigned >> BigInt((7 - i) * 8)) & 0xffn)
    }
    return this
  }

  setInt64BE(value: number | bigint, mode: ByteAccessorTruncateMode = 'truncate') {
    const bigintValue = this.#normalizeInt(
      value,
      -0x8000_0000_0000_0000n,
      0x7fff_ffff_ffff_ffffn,
      mode,
      0xffff_ffff_ffff_ffffn,
    )
    this.#ensureCapacity(8)
    const unsigned = bigintValue & 0xffff_ffff_ffff_ffffn
    for (let i = 0; i < 8; i++) {
      this.#buffer[this.#pointer + i] = Number((unsigned >> BigInt((7 - i) * 8)) & 0xffn)
    }
    return this
  }
  // #endregion int64BE

  // #region bytes
  writeBytes(data: Uint8Array) {
    this.#ensureCapacity(data.length)
    this.#buffer.set(data, this.#pointer)
    this.#pointer += data.length
    return this
  }

  setBytes(data: Uint8Array) {
    this.#ensureCapacity(data.length)
    this.#buffer.set(data, this.#pointer)
    return this
  }
  // #endregion bytes

  // #region string
  writeString(value: string) {
    return this.writeBytes(new TextEncoder().encode(value))
  }

  setString(value: string) {
    return this.setBytes(new TextEncoder().encode(value))
  }
  // #endregion string

  // #region bit
  setBit(
    value: number,
    bitPosStart: number,
    bitPosEnd: number,
    mode: ByteAccessorTruncateMode = 'truncate',
  ) {
    if (bitPosStart < 1 || bitPosEnd < bitPosStart) throw new RangeError('Invalid bit range')
    const bitCount = bitPosEnd - bitPosStart + 1
    const max = (1 << bitCount) - 1
    value = this.#checkRange(value, 0, max, mode)
    const endByte = Math.floor((bitPosEnd - 1) / 8)
    this.#ensureCapacity(endByte + 1)
    let remaining = bitCount
    let msb0 = bitPosStart - 1
    while (remaining > 0) {
      const byteIndex = Math.floor(msb0 / 8)
      const byteMsb0 = msb0 % 8
      const bitsInThisByte = Math.min(8 - byteMsb0, remaining)
      const lsbEnd = 7 - byteMsb0 - bitsInThisByte + 1
      const mask = ((1 << bitsInThisByte) - 1) << lsbEnd
      const _shift = remaining - bitsInThisByte
      const valueBits = (value >> _shift) & ((1 << bitsInThisByte) - 1)
      this.#buffer[this.#pointer + byteIndex] =
        (this.#buffer[this.#pointer + byteIndex] & ~mask) | (valueBits << lsbEnd)
      remaining -= bitsInThisByte
      msb0 += bitsInThisByte
    }
    return this
  }
  // #endregion bit

  // #region static
  static byteLength(data: Uint8Array) {
    return data.length
  }

  static stringByteLength(str: string) {
    return new TextEncoder().encode(str).length
  }
  // #endregion static

  // #region pointer
  moveTo(pos: number) {
    this.#pointer = pos
    return this
  }

  moveBy(offset: number) {
    this.#pointer += offset
    return this
  }
  // #endregion pointer

  // #region output
  toUint8Array() {
    return this.#buffer.slice(0, this.#end)
  }
  slice(start = 0, end = this.#end) {
    return this.#buffer.slice(start, end)
  }
  // #endregion output
}
// #endregion ByteWriter

// #region ByteReader
export class ByteReader {
  #buffer: Uint8Array
  #pointer = 0

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer
  }

  get pointer() {
    return this.#pointer
  }
  get length() {
    return this.#buffer.length
  }
  get byteLength() {
    return this.#buffer.length
  }
  get remaining() {
    return this.#buffer.length - this.#pointer
  }

  // #region internal
  #checkReadable(bytes: number, mode: ByteAccessorReadMode = 'error') {
    if (this.#pointer + bytes > this.#buffer.length) {
      if (mode === 'blank' || mode === 'fill') return
      throw new RangeError(`Cannot read ${bytes} bytes: only ${this.remaining} bytes remaining`)
    }
  }

  #readByte(pos: number, mode: ByteAccessorReadMode): number {
    const byte = this.#buffer[pos]
    return byte ?? (mode === 'fill' ? 1 : 0)
  }
  // #endregion internal

  // #region uint8 / byte
  readUint8(mode: ByteAccessorReadMode = 'error'): bigint {
    const v = this.getUint8(mode)
    this.#pointer += 1
    return v
  }

  getUint8(mode: ByteAccessorReadMode = 'error'): bigint {
    this.#checkReadable(1, mode)
    return BigInt(this.#readByte(this.#pointer, mode))
  }

  readByte = this.readUint8
  getByte = this.getUint8
  // #endregion uint8 / byte

  // #region int8
  readInt8(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.readUint8(mode)
    return value >= 0x80n ? value - 0x100n : value
  }

  getInt8(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.getUint8(mode)
    return value >= 0x80n ? value - 0x100n : value
  }
  // #endregion int8

  // #region uint16LE
  readUint16LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const v = this.getUint16LE(mode)
    this.#pointer += 2
    return v
  }

  getUint16LE(mode: ByteAccessorReadMode = 'error'): bigint {
    this.#checkReadable(2, mode)
    return (
      BigInt(this.#readByte(this.#pointer, mode))
      | (BigInt(this.#readByte(this.#pointer + 1, mode)) << 8n)
    )
  }
  // #endregion uint16LE

  // #region int16LE
  readInt16LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.readUint16LE(mode)
    return value >= 0x8000n ? value - 0x1_0000n : value
  }

  getInt16LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.getUint16LE(mode)
    return value >= 0x8000n ? value - 0x1_0000n : value
  }
  // #endregion int16LE

  // #region uint16BE
  readUint16BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const v = this.getUint16BE(mode)
    this.#pointer += 2
    return v
  }

  getUint16BE(mode: ByteAccessorReadMode = 'error'): bigint {
    this.#checkReadable(2, mode)
    return (
      (BigInt(this.#readByte(this.#pointer, mode)) << 8n)
      | BigInt(this.#readByte(this.#pointer + 1, mode))
    )
  }
  // #endregion uint16BE

  // #region int16BE
  readInt16BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.readUint16BE(mode)
    return value >= 0x8000n ? value - 0x1_0000n : value
  }

  getInt16BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.getUint16BE(mode)
    return value >= 0x8000n ? value - 0x1_0000n : value
  }
  // #endregion int16BE

  // #region uint32LE
  readUint32LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const v = this.getUint32LE(mode)
    this.#pointer += 4
    return v
  }

  getUint32LE(mode: ByteAccessorReadMode = 'error'): bigint {
    this.#checkReadable(4, mode)
    return (
      BigInt(this.#readByte(this.#pointer, mode))
      | (BigInt(this.#readByte(this.#pointer + 1, mode)) << 8n)
      | (BigInt(this.#readByte(this.#pointer + 2, mode)) << 16n)
      | (BigInt(this.#readByte(this.#pointer + 3, mode)) << 24n)
    )
  }
  // #endregion uint32LE

  // #region int32LE
  readInt32LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.readUint32LE(mode)
    return value >= 0x8000_0000n ? value - 0x1_0000_0000n : value
  }

  getInt32LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.getUint32LE(mode)
    return value >= 0x8000_0000n ? value - 0x1_0000_0000n : value
  }
  // #endregion int32LE

  // #region uint32BE
  readUint32BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const v = this.getUint32BE(mode)
    this.#pointer += 4
    return v
  }

  getUint32BE(mode: ByteAccessorReadMode = 'error'): bigint {
    this.#checkReadable(4, mode)
    return (
      (BigInt(this.#readByte(this.#pointer, mode)) << 24n)
      | (BigInt(this.#readByte(this.#pointer + 1, mode)) << 16n)
      | (BigInt(this.#readByte(this.#pointer + 2, mode)) << 8n)
      | BigInt(this.#readByte(this.#pointer + 3, mode))
    )
  }
  // #endregion uint32BE

  // #region int32BE
  readInt32BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.readUint32BE(mode)
    return value >= 0x8000_0000n ? value - 0x1_0000_0000n : value
  }

  getInt32BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.getUint32BE(mode)
    return value >= 0x8000_0000n ? value - 0x1_0000_0000n : value
  }
  // #endregion int32BE

  // #region uint64LE
  readUint64LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const v = this.getUint64LE(mode)
    this.#pointer += 8
    return v
  }

  getUint64LE(mode: ByteAccessorReadMode = 'error'): bigint {
    this.#checkReadable(8, mode)
    let value = 0n
    for (let i = 7; i >= 0; i--)
      value = (value << 8n) | BigInt(this.#readByte(this.#pointer + i, mode))
    return value
  }
  // #endregion uint64LE

  // #region int64LE
  readInt64LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.readUint64LE(mode)
    return value >= 0x8000_0000_0000_0000n ? value - 0x1_0000_0000_0000_0000n : value
  }

  getInt64LE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.getUint64LE(mode)
    return value >= 0x8000_0000_0000_0000n ? value - 0x1_0000_0000_0000_0000n : value
  }
  // #endregion int64LE

  // #region uint64BE
  readUint64BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const v = this.getUint64BE(mode)
    this.#pointer += 8
    return v
  }

  getUint64BE(mode: ByteAccessorReadMode = 'error'): bigint {
    this.#checkReadable(8, mode)
    let value = 0n
    for (let i = 0; i < 8; i++)
      value = (value << 8n) | BigInt(this.#readByte(this.#pointer + i, mode))
    return value
  }
  // #endregion uint64BE

  // #region int64BE
  readInt64BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.readUint64BE(mode)
    return value >= 0x8000_0000_0000_0000n ? value - 0x1_0000_0000_0000_0000n : value
  }

  getInt64BE(mode: ByteAccessorReadMode = 'error'): bigint {
    const value = this.getUint64BE(mode)
    return value >= 0x8000_0000_0000_0000n ? value - 0x1_0000_0000_0000_0000n : value
  }
  // #endregion int64BE

  // #region bytes
  readBytes(length: number, mode: ByteAccessorReadMode = 'error') {
    const chunk = this.getBytes(length, mode)
    this.#pointer += length
    return chunk
  }

  getBytes(length: number, mode: ByteAccessorReadMode = 'error') {
    this.#checkReadable(length, mode)
    const chunk = new Uint8Array(length)
    for (let i = 0; i < length; i++) chunk[i] = this.#readByte(this.#pointer + i, mode)
    return chunk
  }
  // #endregion bytes

  // #region string
  readString(length: number, mode: ByteAccessorReadMode = 'error') {
    return new TextDecoder().decode(this.readBytes(length, mode))
  }

  getString(length: number, mode: ByteAccessorReadMode = 'error') {
    return new TextDecoder().decode(this.getBytes(length, mode))
  }
  // #endregion string

  // #region bit
  readBit(bitPosStart: number, bitPosEnd: number, mode: ByteAccessorReadMode = 'error') {
    if (bitPosStart < 1 || bitPosEnd < bitPosStart) throw new RangeError('Invalid bit range')
    const bitCount = bitPosEnd - bitPosStart + 1
    const endByte = Math.floor((bitPosEnd - 1) / 8)
    this.#checkReadable(endByte + 1, mode)
    let value = 0
    let remaining = bitCount
    let msb0 = bitPosStart - 1
    while (remaining > 0) {
      const byteIndex = Math.floor(msb0 / 8)
      const byteMsb0 = msb0 % 8
      const bitsInThisByte = Math.min(8 - byteMsb0, remaining)
      const lsbEnd = 7 - byteMsb0 - bitsInThisByte + 1
      const mask = ((1 << bitsInThisByte) - 1) << lsbEnd
      const byteVal = (this.#readByte(this.#pointer + byteIndex, mode) & mask) >> lsbEnd
      value = (value << bitsInThisByte) | byteVal
      remaining -= bitsInThisByte
      msb0 += bitsInThisByte
    }
    return value
  }
  // #endregion bit

  // #region static
  static byteLength(data: Uint8Array) {
    return data.length
  }

  static stringByteLength(str: string) {
    return new TextEncoder().encode(str).length
  }
  // #endregion static

  // #region pointer
  moveTo(pos: number) {
    this.#pointer = pos
    return this
  }

  moveBy(offset: number) {
    this.#pointer += offset
    return this
  }
  // #endregion pointer
}
// #endregion ByteReader
