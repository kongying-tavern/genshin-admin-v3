export const isUnknown = <T = unknown>(v: T) => {
  if (typeof v !== 'object') return v !== undefined
  if (v === null) return true
  return Object.values(v).every(item => item === null || item === undefined)
}
