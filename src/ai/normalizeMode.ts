/** 归一化输入，无法识别时返回 undefined */
export const normalizeBridgeMode = (raw: string | null | undefined) => {
  const value = raw?.trim().toLowerCase()
  if (!value) return undefined
  if (['1', 'on', 'true', 'read', 'query', 'ro', 'readonly'].includes(value)) return 'read'
  if (['2', 'write', 'rw', 'full', 'readwrite'].includes(value)) return 'write'
  if (['0', 'off', 'false', 'none', 'disabled'].includes(value)) return 'off'
  return undefined
}
