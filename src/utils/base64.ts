export const base64ToUint8Array = (base64: string) => {
  if (!base64) return new Uint8Array()
  return new Uint8Array(
    atob(base64)
      .split('')
      .map(c => c.charCodeAt(0)),
  )
}

export const uint8ArrayToBase64 = (data: Uint8Array) => {
  if (!data || !data.byteLength) return ''
  return btoa(String.fromCharCode(...data))
}
