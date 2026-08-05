// Prayer Earth — tiny shared server.
// Tracks how many people are praying right now and the running total of
// collective prayer time, and broadcasts it to everyone.

import { WebSocketServer } from 'ws'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gridKey } from '../src/shared/geo.js'
import { mergeStats } from '../src/shared/stats.js'

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
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'text/xml'
}

// ---- authentic neural voices via Google Cloud TTS, proxied through this
// server so the API key never reaches the browser. Set GOOGLE_TTS_KEY env var.
const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_KEY || ''
// Map each prayer language to a natural Google voice. Languages without an
// entry (Prakrit, Avestan, Yoruba, Zulu…) fall back to the browser's voices.
const TTS_VOICES = {
  ar: 'ar-XA-Wavenet-A',
  he: 'he-IL-Wavenet-B',
  zh: 'zh-CN-Wavenet-B',
  ja: 'ja-JP-Wavenet-B',
  ko: 'ko-KR-Wavenet-A',
  hi: 'hi-IN-Wavenet-A',
  sa: 'hi-IN-Wavenet-A',
  pa: 'pa-IN-Wavenet-A',
  en: 'en-US-Wavenet-E',
  es: 'es-ES-Wavenet-B',
  fr: 'fr-FR-Wavenet-B',
  de: 'de-DE-Wavenet-B',
  pt: 'pt-BR-Wavenet-A',
  it: 'it-IT-Wavenet-B',
  ru: 'ru-RU-Wavenet-B'
}

// Synthesize a short phrase to MP3 via Google Cloud Text-to-Speech.
// Only same-origin callers are allowed and each IP is rate-limited, so a
// runaway client can never run up the TTS bill.
const ttsHits = new Map()
function ttsLimited(ip) {
  const now = Date.now()
  const arr = (ttsHits.get(ip) || []).filter((t) => now - t < 60000)
  if (arr.length >= 20) return true
  arr.push(now)
  ttsHits.set(ip, arr)
  return false
}

async function handleTTS(urlPath, req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end()
    return
  }
  if (ttsLimited(req.socket.remoteAddress || 'unknown')) {
    res.writeHead(429)
    res.end('too many requests')
    return
  }
  res.setHeader('Cache-Control', 'public, max-age=604800')
  if (!GOOGLE_TTS_KEY) {
    res.writeHead(503)
    res.end('no TTS key configured')
    return
  }
  const q = new URL(req.url, 'http://x').searchParams
  const text = (q.get('text') || '').trim()
  const lang = (q.get('lang') || 'en').split('-')[0]
  if (!text) {
    res.writeHead(400)
    res.end()
    return
  }
  const name = TTS_VOICES[lang]
  if (!name) {
    res.writeHead(503)
    res.end('no voice for language')
    return
  }
  const languageCode = name.split('-').slice(0, 2).join('-')
  try {
    const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_TTS_KEY
      },
      body: JSON.stringify({
        input: { text: text.slice(0, 500) },
        voice: { languageCode, name },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 }
      })
    })
    if (!r.ok) {
      res.writeHead(502)
      res.end('google error')
      return
    }
    const data = await r.json()
    if (!data.audioContent) {
      res.writeHead(502)
      res.end('no audio')
      return
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' })
    res.end(Buffer.from(data.audioContent, 'base64'))
  } catch {
    res.writeHead(502)
    res.end('tts failed')
  }
}

// Serve the built app. Hash-named assets are cacheable forever; everything
// else (index.html, sw.js) is served fresh. Unknown paths fall back to
// index.html so deep links never 404 (routing is hash-based anyway).
async function serveStatic(req, res) {
  let urlPath = '/'
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  } catch {}
  if (urlPath === '/api/tts') {
    await handleTTS(urlPath, req, res)
    return
  }
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
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(self), microphone=()',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; " +
        "font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

const httpServer = createServer(serveStatic)
// Cap incoming message size so a hostile client can't blow up memory with a
// single giant frame; normal presence/sync messages are only a few KB.
const wss = new WebSocketServer({ server: httpServer, maxPayload: 300 * 1024 })

let people = 0
let totalPrayerSeconds = 0
const clients = new Map()
const prayerCounts = {}
const spiritCounts = {}
const lights = {}
// Which tradition is brightest at each light cell, so clients can colour a
// cell's glow by faith. Falls back to a generic gold when absent.
const lightSpirits = {}

// Resolve where a persistent JSON file lives. Render's default disk is
// ephemeral, so the deploy config mounts a persistent disk and points
// PE_DATA_DIR at it — that way all-time totals and the anonymous sync survive
// redeploys and restarts. Tests may point at scratch files via PE_DATA_FILE /
// PE_PEOPLE_FILE.
function dataFile(name) {
  if (process.env.PE_DATA_DIR) {
    try {
      mkdirSync(process.env.PE_DATA_DIR, { recursive: true })
    } catch {}
    return pathToFileURL(join(process.env.PE_DATA_DIR, name))
  }
  return new URL(`./${name}`, import.meta.url)
}

// All-time totals of prayers ever carried. Survives restarts via a small JSON
// file so the numbers never reset when the server comes back up.
const SERVER_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = process.env.PE_DATA_FILE
  ? pathToFileURL(resolve(SERVER_DIR, process.env.PE_DATA_FILE))
  : dataFile('data.json')
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

// ---- anonymous lifetime sync ----
// Keeps personal prayer stats keyed by an opaque, random id so they can follow
// a person between devices — no account, no name, nothing that reveals who
// they are.
const PEOPLE_FILE = process.env.PE_PEOPLE_FILE
  ? pathToFileURL(resolve(SERVER_DIR, process.env.PE_PEOPLE_FILE))
  : dataFile('people.json')
const peopleSync = {}
try {
  if (existsSync(PEOPLE_FILE)) {
    Object.assign(peopleSync, JSON.parse(readFileSync(PEOPLE_FILE, 'utf8')))
  }
} catch {}
let peopleSaveTimer = null
function savePeople() {
  clearTimeout(peopleSaveTimer)
  peopleSaveTimer = setTimeout(() => {
    try {
      writeFileSync(PEOPLE_FILE, JSON.stringify(peopleSync))
    } catch {}
  }, 500)
}

// (mergeStats lives in ../src/shared/stats.js so client and server agree.)

// Live "now praying" feed: who started praying recently.
const MAX_FEED = 40
const feed = []
let feedSeq = 0

function pushFeed(name, spiritId, prayerId, lat, lon) {
  const entry = { id: ++feedSeq, t: Date.now(), name, spiritId, prayerId }
  if (typeof lat === 'number' && typeof lon === 'number') entry.cell = gridKey(lat, lon)
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
  for (const k in lightSpirits) delete lightSpirits[k]
  people = 0
  for (const { praying, prayerId, spiritId, lat, lon } of clients.values()) {
    if (!praying) continue
    people += 1
    if (prayerId) prayerCounts[prayerId] = (prayerCounts[prayerId] || 0) + 1
    if (spiritId) spiritCounts[spiritId] = (spiritCounts[spiritId] || 0) + 1
    if (typeof lat === 'number' && typeof lon === 'number') {
      const key = gridKey(lat, lon)
      lights[key] = (lights[key] || 0) + 1
      if (spiritId) lightSpirits[key] = spiritId
    }
  }
}

// How many people have prayed today / in the last seven days, counted from the
// anonymous sync data. Drives the Earth's glow along with the all-time totals.
function countActiveUsers() {
  let today = 0
  let week = 0
  const day = (t) =>
    `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
      t.getDate()
    ).padStart(2, '0')}`
  const now = new Date()
  const todayKey = day(now)
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)
  const weekKey = day(weekAgo)
  for (const p of Object.values(peopleSync)) {
    const days = p.prayerDayCompletions || {}
    if (p.lastPrayedDay === todayKey || days[todayKey]) today++
    for (const d of Object.keys(days)) {
      if (d >= weekKey) {
        week++
        break
      }
    }
  }
  return { today, week }
}

function broadcast() {
  const { today, week } = countActiveUsers()
  const payload = JSON.stringify({
    type: 'state',
    people,
    totalPrayerSeconds: Math.round(totalPrayerSeconds),
    prayers: prayerCounts,
    spirits: spiritCounts,
    lights,
    lightSpirits,
    usersToday: today,
    usersWeek: week,
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
        const prayerId =
          typeof msg.prayerId === 'string' ? msg.prayerId.slice(0, 60) : prev.prayerId
        const spiritId =
          typeof msg.spiritId === 'string' ? msg.spiritId.slice(0, 60) : prev.spiritId
        // The engine protocol sends a coarse "lat,lon" cell (never a precise
        // position); older clients send lat/lon directly.
        let lat = null
        let lon = null
        if (typeof msg.cell === 'string') {
          const [la, lo] = msg.cell.split(',').map(Number)
          if (isFinite(la) && isFinite(lo)) {
            lat = la
            lon = lo
          }
        } else {
          lat = typeof msg.lat === 'number' && isFinite(msg.lat) ? msg.lat : prev.lat
          lon = typeof msg.lon === 'number' && isFinite(msg.lon) ? msg.lon : prev.lon
        }
        clients.set(ws, {
          praying: !!msg.praying,
          prayerId: msg.praying ? prayerId : null,
          spiritId: msg.praying ? spiritId : null,
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
          pushFeed(c.name, c.spiritId, c.prayerId, c.lat, c.lon)
          const payload = feedPayload()
          for (const client of clients.keys()) {
            if (client.readyState === client.OPEN) client.send(payload)
          }
        }
      } else if (msg.type === 'sync') {
        // Anonymous lifetime sync: merge this device's counters and reply with
        // the merged result so every device converges on the same totals.
        const id = typeof msg.anonId === 'string' ? msg.anonId.slice(0, 64) : ''
        if (id) {
          // Cap the incoming payload so an abusive client can't bloat memory
          // or the people.json file with unbounded nested objects.
          let stats = msg.stats || {}
          try {
            if (JSON.stringify(stats).length > 250000) stats = {}
          } catch {
            stats = {}
          }
          const merged = mergeStats(peopleSync[id], stats)
          peopleSync[id] = merged
          savePeople()
          ws.send(JSON.stringify({ type: 'sync', stats: merged }))
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
      lightSpirits,
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
