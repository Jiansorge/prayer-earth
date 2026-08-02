// Prayer Earth — tiny shared server.
// Tracks how many people are praying right now and the running total of
// collective prayer time, and broadcasts it to everyone.

import { WebSocketServer } from 'ws'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = process.env.PORT || 8787
const DIST = fileURLToPath(new URL('../dist/', import.meta.url))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
}

// Serve the built app. Hash-named assets are cacheable forever; everything
// else (index.html, sw.js) is served fresh. Unknown paths fall back to
// index.html so deep links never 404 (routing is hash-based anyway).
async function serveStatic(req, res) {
  let urlPath = '/'
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  } catch {}
  const filePath = normalize(join(DIST, urlPath))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  let target = filePath
  try {
    const info = await stat(target)
    if (info.isDirectory()) target = join(target, 'index.html')
  } catch {
    target = join(DIST, 'index.html')
  }
  try {
    const body = await readFile(target)
    const isAsset = /\/assets\//.test(urlPath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(target)] || 'application/octet-stream',
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

const httpServer = createServer(serveStatic)
const wss = new WebSocketServer({ server: httpServer })

let people = 0
let totalPrayerSeconds = 0
const clients = new Map()
const prayerCounts = {}
const spiritCounts = {}
const lights = {}

// Rounds a coordinate onto the shared 2-degree light grid the app renders.
// Praying users nearby land on the same cell and become one brighter light.
function gridKey(lat, lon) {
  const la = Math.max(-60, Math.min(72, Math.round(lat / 2) * 2))
  let lo = Math.round(lon / 2) * 2
  if (lo >= 180) lo = -180
  return `${la},${lo}`
}

// All-time totals of prayers ever carried. Survives restarts via a small JSON
// file so the numbers never reset when the server comes back up. Tests may
// point at a scratch file via PE_DATA_FILE.
const DATA_FILE = process.env.PE_DATA_FILE
  ? new URL(process.env.PE_DATA_FILE, import.meta.url)
  : new URL('./data.json', import.meta.url)
const prayerTotals = {}
const spiritTotals = {}
try {
  if (existsSync(DATA_FILE)) {
    const d = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    if (d.prayers) Object.assign(prayerTotals, d.prayers)
    if (d.spirits) Object.assign(spiritTotals, d.spirits)
  }
} catch {}
let saveTimer = null
function saveTotals() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      writeFileSync(DATA_FILE, JSON.stringify({ prayers: prayerTotals, spirits: spiritTotals }))
    } catch {}
  }, 500)
}

// Live "now praying" feed: who started praying recently.
const MAX_FEED = 40
const feed = []
let feedSeq = 0

function pushFeed(name, spiritId, prayerId) {
  const entry = { id: ++feedSeq, t: Date.now(), name, spiritId, prayerId }
  feed.push(entry)
  if (feed.length > MAX_FEED) feed.splice(0, feed.length - MAX_FEED)
  return entry
}

function feedPayload() {
  return JSON.stringify({ type: 'feed', feed })
}

function recount() {
  for (const k in prayerCounts) delete prayerCounts[k]
  for (const k in spiritCounts) delete spiritCounts[k]
  for (const k in lights) delete lights[k]
  people = 0
  for (const { praying, prayerId, spiritId, lat, lon } of clients.values()) {
    if (!praying) continue
    people += 1
    if (prayerId) prayerCounts[prayerId] = (prayerCounts[prayerId] || 0) + 1
    if (spiritId) spiritCounts[spiritId] = (spiritCounts[spiritId] || 0) + 1
    if (typeof lat === 'number' && typeof lon === 'number') {
      const key = gridKey(lat, lon)
      lights[key] = (lights[key] || 0) + 1
    }
  }
}

function broadcast() {
  const payload = JSON.stringify({
    type: 'state',
    people,
    totalPrayerSeconds: Math.round(totalPrayerSeconds),
    prayers: prayerCounts,
    spirits: spiritCounts,
    lights,
    totals: {
      prayers: prayerTotals,
      spirits: spiritTotals
    }
  })
  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) ws.send(payload)
  }
}

// Even with no one connected, the world keeps praying a little.
setInterval(() => {
  if (clients.size === 0) return
  totalPrayerSeconds += clients.size * 0.25
  broadcast()
}, 250)

// Reap dead connections: a phone or tab that was killed without closing its
// socket leaves a half-open connection on Windows, and stale clients would
// otherwise inflate the prayer counts forever.
setInterval(() => {
  let removed = false
  for (const ws of clients.keys()) {
    if (ws.isAlive === false) {
      clients.delete(ws)
      ws.terminate()
      removed = true
      continue
    }
    ws.isAlive = false
    try {
      ws.ping()
    } catch {
      clients.delete(ws)
      ws.terminate()
      removed = true
    }
  }
  if (removed) {
    recount()
    broadcast()
  }
}, 15000)

wss.on('connection', (ws) => {
  ws.isAlive = true
  ws.on('pong', () => {
    ws.isAlive = true
  })
  clients.set(ws, { praying: false, prayerId: null, spiritId: null, lat: null, lon: null })

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'presence') {
        const prev = clients.get(ws)
        const name = typeof msg.name === 'string' && msg.name.trim() ? msg.name.slice(0, 24) : 'Someone'
        const lat = typeof msg.lat === 'number' && isFinite(msg.lat) ? msg.lat : prev.lat
        const lon = typeof msg.lon === 'number' && isFinite(msg.lon) ? msg.lon : prev.lon
        clients.set(ws, {
          praying: !!msg.praying,
          prayerId: msg.praying ? msg.prayerId || prev.prayerId : null,
          spiritId: msg.praying ? msg.spiritId || prev.spiritId : null,
          name,
          lat,
          lon
        })
        // Count a freshly-started prayer toward the all-time totals (once per
        // prayer per person — the presence ping repeats every few seconds).
        const c = clients.get(ws)
        if (msg.praying && c.prayerId && c.prayerId !== prev.prayerId) {
          prayerTotals[c.prayerId] = (prayerTotals[c.prayerId] || 0) + 1
          if (c.spiritId) spiritTotals[c.spiritId] = (spiritTotals[c.spiritId] || 0) + 1
          saveTotals()
        }
        recount()
        broadcast()
        // When a soul starts praying, share it with the world.
        if (msg.praying && !prev.praying && prev.prayerId === null) {
          pushFeed(c.name, c.spiritId, c.prayerId)
          const payload = feedPayload()
          for (const client of clients.keys()) {
            if (client.readyState === client.OPEN) client.send(payload)
          }
        }
      }
    } catch {}
  })

  ws.send(
    JSON.stringify({
      type: 'state',
      people,
      totalPrayerSeconds: Math.round(totalPrayerSeconds),
      prayers: prayerCounts,
      spirits: spiritCounts,
      lights,
      totals: {
        prayers: prayerTotals,
        spirits: spiritTotals
      }
    })
  )
  ws.send(feedPayload())

  ws.on('close', () => {
    clients.delete(ws)
    recount()
    broadcast()
  })
})

httpServer.listen(PORT, () => {
  console.log(`☮  Prayer Earth is up: app + sync on port ${PORT}`)
})
