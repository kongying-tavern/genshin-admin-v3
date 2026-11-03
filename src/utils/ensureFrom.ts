export const ensureFrom = <T, K extends keyof T>(obj: T, key: K, setter: () => T[K]) => {
  if (obj[key] === undefined) obj[key] = setter()
  return obj[key]
}
