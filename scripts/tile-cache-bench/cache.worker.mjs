const prefix = new URL('cached/', self.registration.scope).href

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', event => {
  const { method, url } = event.request
  if (method !== 'GET' || !url.startsWith(prefix)) return

  const match = /^([a-f0-9-]+)\/\d+\.png$/.exec(url.slice(prefix.length))
  if (!match) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(`tile-cache-bench-${match[1]}`)
      const response = await cache.match(event.request)
      return response ?? new Response(null, { status: 404 })
    })(),
  )
})
