// Joining Palms, offline-ready service worker.
//
// NOTE, when you change the MP3 library or remove prayers, stale audio will
// keep being served from the cache-first SW (and the Cloudflare CDN). To ship
// the new audio: bump the cache name below by one (v2 → v3 → …). The new SW
// installs, deletes the old cache in `activate`, and re-caches fresh files. If
// the app is served through Cloudflare, also purge the CDN cache for /audio/*
// so the edge stops handing out the old files.
const CACHE = 'prayer-earth-v2'
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon-180.png'
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          })
          .catch(() => caches.match('/index.html'))
    )
  )
})
