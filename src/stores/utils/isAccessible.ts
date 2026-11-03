export const isAccessible = (userFlag: number, hiddenFlag?: number) => {
  if (hiddenFlag === undefined) return true
  return (userFlag & (1 << hiddenFlag)) > 0
}
