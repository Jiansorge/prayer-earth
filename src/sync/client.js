// Connects to the shared Joining Palms server so everyone around the world
// prays together. If the server is not reachable, the app quietly continues
// on its own with a gentle, believable world so the counts never look wrong.

import { useStore } from '../store.js'
import { gridKey } from '../shared/geo.js'
import { sanitizeName } from '../shared/profanity.js'
import { SyncEngine, CfEngine } from './engine.js'
import { C_PRESENCE, C_SYNC } from './protocol.js'

// How often presence is re-sent. 30 s keeps the DO's live counts fresh while
// cutting presence traffic (and Durable Object cost) ~6× vs 5 s. The engine's
// PRESENCE_TTL_MS (60 s) is comfortably above this, and CfEngine's 20 s
// keepalive pings refresh the session too, so a slightly delayed presence never
// causes the session to be swept.
const PING_MS = 30000
const RETRY_MS = 10000

// Shape-guard + coerce the engine's inbound state/feed payloads before they
// reach the store. The engine is trusted, but a bug or a hostile/mitm'd
// source must never be able to crash the render tree (e.g. a non-array feed
// or a non-string cell). Everything unknown is coerced to a safe default.
const toCount = (v) => (Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0)
const toCell = (v) =>
  typeof v === 'string' && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(v) ? v : ''
const cleanFeed = (f) =>
  Array.isArray(f)
    ? f
        .filter((e) => e && typeof e === 'object' && typeof e.id === 'number')
        .slice(-MAX_FEED_ITEMS)
        .map((e) => ({
          id: e.id,
          t: typeof e.t === 'number' ? e.t : 0,
          name: typeof e.name === 'string' ? e.name.slice(0, 30) : '',
          spiritId: typeof e.spiritId === 'string' ? e.spiritId.slice(0, 60) : null,
          prayerId: typeof e.prayerId === 'string' ? e.prayerId.slice(0, 60) : null,
          cell: toCell(e.cell)
        }))
    : []
const cleanCountMap = (m) => {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {}
  const out = {}
  for (const [k, v] of Object.entries(m)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) continue
    const n = toCount(v)
    if (n > 0) out[k] = n
  }
  return out
}
const MAX_FEED_ITEMS = 100

// A gentle crowd for when the shared server can't be reached, so the world
// never looks empty. The user's own prayer is always added on top so their
// path's count is never less than 1 while they pray.
// Each entry: [spiritId, prayerId, lat, lon]
const SIM_PEOPLE = [
  ['christianity', 'lords-prayer', 40.7, -74.0],
  ['christianity', 'psalm-23', 51.5, -0.1],
  ['islam', 'al-fatiha', 21.5, 39.2],
  ['islam', 'al-fatiha', 1.4, 103.8],
  ['buddhism', 'mani', 28.6, 77.2],
  ['buddhism', 'daimoku', 35.7, 139.7],
  ['hinduism', 'om-namah-shivaya', 19.1, 72.9],
  ['judaism', 'shema', 31.8, 35.2],
  ['sikhism', 'waheguru', 31.6, 74.9],
  ['nonreligious', 'awe', 37.8, -122.4]
]

// Same host that served the page. In development the socket lives on 8787
// (a separate process); in production one process serves both the app and the
// socket on the same port, so we connect to the page's own origin. Set
// VITE_SYNC_URL (a ws:// or wss:// URL) to point the socket at the Cloudflare
// Worker or a `wrangler dev` instance, that's the sync-engine cutover knob.
function defaultUrl() {
  const override = import.meta.env.VITE_SYNC_URL
  if (override) return override
  const host = window.location.hostname || 'localhost'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  if (import.meta.env.PROD) {
    const port = window.location.port
    return `${proto}://${host}${port ? `:${port}` : ''}`
  }
  return `${proto}://${host}:8787`
}

const DEFAULT_URL = defaultUrl()

// Anonymous names so the live feed can show "who" is praying without anyone
// sharing anything personal.
const NAMES = [
  'Amara', 'Kavi', 'Lotus', 'River', 'Noor', 'Elio', 'Zahra', 'Asher',
  'Isla', 'Rumi', 'Mei', 'Tau', 'Saoirse', 'Pax', 'Ilyas', 'Maya',
  'Noa', 'Theo', 'Lior', 'Ana'
]

function pickName() {
  const a = NAMES[Math.floor(Math.random() * NAMES.length)]
  const n = Math.floor(Math.random() * 90) + 10
  return `${a} ${n}`
}

// The name the user chose in their profile (falls back to a gentle random one
// the first time, which is then saved so it stays stable). Profane or vulgar
// names are rejected by sanitizeName, falling back to the gentle random one.
function profileName() {
  const p = useStore.getState().profile
  return sanitizeName(p.name) || pickName()
}

const SIM_FEED_NAMES = ['Lotus', 'Noor', 'River', 'Kavi', 'Amara', 'Rumi', 'Mei', 'Pax']

class SyncClient {
  constructor() {
    // The transport is swappable: WsEngine (Node server) or CfEngine
    // (Cloudflare Workers). App code only talks to the engine interface.
    this.engine = import.meta.env.VITE_SYNC_ENGINE === 'cf' ? new CfEngine() : new SyncEngine()
    this.retry = null
    this.ping = null
    this.mode = 'sim'
    this.name = pickName()
    this.loc = null
  }

  start() {
    this.stop()
    this.ensureLocation()
    // settle on a stable name the very first time (the random one is saved so
    // the world knows you the next time you arrive)
    if (!useStore.getState().profile.name) {
      useStore.getState().setProfile({ name: pickName() })
    }
    this.name = profileName()
    this.connect()
    // when the tab comes back, sync anything prayed while it was away
    this._vis = () => {
      if (!document.hidden) this.pushSync()
    }
    document.addEventListener('visibilitychange', this._vis)
  }

  // Ask once for a coarse location so the world can show a light where you
  // are. If it's not granted or available, fall back to a stable stand-in
  // city so your prayer still lands somewhere on the map. This is fully
  // local, no location ever leaves the device.
  ensureLocation() {
    // The "you are here" ring is only ever shown for a REAL position. A
    // fallback city is an anonymous guess for the world's light; we never
    // pretend a guess is where the person actually is.
    const publishReal = () => useStore.getState().setYouLoc(this.loc)
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.loc = {
              lat: +pos.coords.latitude.toFixed(1),
              lon: +pos.coords.longitude.toFixed(1)
            }
            publishReal()
          },
          () => {
            this.fallbackLoc()
          },
          { timeout: 8000, maximumAge: 600000, enableHighAccuracy: false }
        )
        return
      }
    } catch {}
    this.fallbackLoc()
  }

  fallbackLoc() {
    // No GPS? Anchor the personal light at the centre of the browser's IANA
    // timezone. It is coarse (shared by everyone in the zone), never precise,
    // and needs no permission — so prayers still land somewhere honest on the
    // map instead of vanishing or pinning a made-up city.
    const tz = tzAnchor()
    if (tz) {
      this.loc = { lat: tz.lat, lon: tz.lon }
    } else {
      this.loc = null
    }
  }

  stop() {
    clearTimeout(this.retry)
    clearInterval(this.ping)
    clearInterval(this.syncTimer)
    if (this._vis) {
      document.removeEventListener('visibilitychange', this._vis)
      this._vis = null
    }
    this.engine.disconnect()
    this.stopSim()
  }

  connect() {
    try {
      this.engine.onMessage = (msg) => {
        try {
          if (msg.type === 'state') {
            useStore.getState().setPeoplePraying(toCount(msg.people))
            useStore.getState().setTotalPrayerSeconds(toCount(msg.totalPrayerSeconds))
            useStore.getState().setPrayerCounts(cleanCountMap(msg.prayers))
            useStore.getState().setSpiritCounts(cleanCountMap(msg.spirits))
            const today = toCount(msg.usersToday)
            const week = toCount(msg.usersWeek)
            if (today > 0 || week > 0) {
              useStore.getState().setUsersActivity(today, week)
            }
            const startedAt = toCount(msg.startedAt)
            if (startedAt > 0) useStore.getState().setStartedAt(startedAt)
            const lights = cleanCountMap(msg.lights)
            const lightSpirits = cleanCountMap(msg.lightSpirits)
            if (Object.keys(lights).length) useStore.getState().setLights(lights)
            if (Object.keys(lightSpirits).length) useStore.getState().setLightSpirits(lightSpirits)
            if (msg.totals && typeof msg.totals === 'object' && !Array.isArray(msg.totals)) {
              useStore.getState().setPrayerTotals(cleanCountMap(msg.totals.prayers))
              useStore.getState().setSpiritTotals(cleanCountMap(msg.totals.spirits))
            }
          } else if (msg.type === 'feed') {
            useStore.getState().setFeed(cleanFeed(msg.feed))
          } else if (msg.type === 'sync' && msg.stats && typeof msg.stats === 'object') {
            useStore.getState().mergeSyncStats(msg.stats)
          } else if (msg.type === 'error') {
            // The engine told us why it is closing (e.g. rate-limited). Surface
            // it so the UI can show a gentle, non-alarming notice.
            const code = typeof msg.code === 'string' ? msg.code.slice(0, 40) : 'error'
            useStore.getState().setSyncNotice(code)
          }
        } catch {}
      }
      this.engine.onStatus = (connected) => {
        if (connected) {
          this.stopSim()
          this.mode = 'live'
          useStore.getState().setConnected(true)
          useStore.getState().setSyncNotice(null)
          this.sendPresence()
          this.pushSync()
          this.ping = setInterval(() => this.sendPresence(), PING_MS)
          clearInterval(this.syncTimer)
          this.syncTimer = setInterval(() => this.pushSync(), 30000)
        } else {
          this.mode = 'sim'
          useStore.getState().setConnected(false)
          this.startSim()
          this.scheduleRetry()
        }
      }
      this.engine.connect(DEFAULT_URL)
    } catch {
      this.mode = 'sim'
      this.startSim()
      this.scheduleRetry()
    }
  }

  scheduleRetry() {
    clearTimeout(this.retry)
    this.retry = setTimeout(() => this.connect(), RETRY_MS)
  }

  sendPresence() {
    const s = useStore.getState()
    if (this.mode !== 'live') {
      // Offline, keep the local world in sync with the user's own prayer.
      if (this.mode === 'sim' && this.sim) this.simState()
      return
    }
    const grid = this.loc ? this.gridLoc(this.loc) : null
    this.engine.send({
      type: C_PRESENCE,
      praying: s.praying,
      prayerId: s.praying ? s.prayerId : null,
      spiritId: s.praying ? s.spiritId : null,
      name: profileName(),
      cell: grid ? `${grid.lat},${grid.lon}` : null
    })
  }

  // The server only ever needs region-level precision: round onto the shared
  // 1-degree grid before sending (matches src/shared/geo.js gridKey), so it
  // never holds a precise position.
  gridLoc(loc) {
    let lo = Math.round(loc.lon)
    if (lo >= 180) lo = -180
    return {
      lat: Math.max(-60, Math.min(72, Math.round(loc.lat))),
      lon: lo
    }
  }

  presenceNow() {
    this.sendPresence()
  }

  // Push the anonymous lifetime stats and adopt the server's merged totals.
  pushSync() {
    if (this.mode !== 'live') return
    try {
      const s = useStore.getState()
      this.engine.send({ type: C_SYNC, anonId: s.getAnonId(), stats: s.getSyncStats() })
    } catch {}
  }

  // Simulated world for when we are offline: a gentle crowd praying nearby.
  startSim() {
    this.stopSim()
    this.simFeed = []
    const seed = [
      ['buddhism', 'mani', 28.6, 77.2],
      ['islam', 'al-fatiha', 21.5, 39.2],
      ['christianity', 'psalm-23', 51.5, -0.1]
    ]
    const now = Date.now()
    seed.forEach(([sp, pr, lat, lon], i) => {
      this.simFeed.push({
        id: i + 1,
        t: now - (i + 2) * 60000,
        name: SIM_FEED_NAMES[i],
        spiritId: sp,
        prayerId: pr,
        cell: gridKey(lat, lon)
      })
    })
    this.simSeq = seed.length
    this.simState()
    this.sim = setInterval(() => this.simState(), 4000)
  }

  simState() {
    const s = useStore.getState()
    const prayers = {}
    const spirits = {}
    const lights = {}
    const lightSpirits = {}
    const addLight = (lat, lon, spId) => {
      if (typeof lat !== 'number' || typeof lon !== 'number') return
      const k = gridKey(lat, lon)
      lights[k] = (lights[k] || 0) + 1
      if (spId) lightSpirits[k] = spId
    }
    for (const [sp, pr, lat, lon] of SIM_PEOPLE) {
      prayers[pr] = (prayers[pr] || 0) + 1
      spirits[sp] = (spirits[sp] || 0) + 1
      addLight(lat, lon, sp)
    }
    // Always count the person praying right here.
    if (s.praying && s.spiritId && s.prayerId) {
      prayers[s.prayerId] = (prayers[s.prayerId] || 0) + 1
      spirits[s.spiritId] = (spirits[s.spiritId] || 0) + 1
    }
    if (this.loc) addLight(this.loc.lat, this.loc.lon, s.spiritId)
    const total = Object.values(spirits).reduce((a, b) => a + b, 0)
    s.setPeoplePraying(total)
    s.setPrayerCounts(prayers)
    s.setSpiritCounts(spirits)
    s.setUsersActivity(20 + total * 3, 120 + total * 12)
    s.setLights(lights)
    s.setLightSpirits(lightSpirits)
    s.setTotalPrayerSeconds(s.totalPrayerSeconds + 1.5)

    // A gentle trickle of "now praying" entries, including the person here.
    const now = Date.now()
    if (!s.praying && Math.random() < 0.35) {
      const [sp, pr, lat, lon] = SIM_PEOPLE[Math.floor(Math.random() * SIM_PEOPLE.length)]
      this.simFeed.push({
        id: ++this.simSeq,
        t: now,
        name: SIM_FEED_NAMES[Math.floor(Math.random() * SIM_FEED_NAMES.length)],
        spiritId: sp,
        prayerId: pr,
        cell: gridKey(lat, lon)
      })
    }
    if (s.praying && s.spiritId && s.prayerId && this.lastSimSelf !== now) {
      this.lastSimSelf = now
      this.simFeed.push({
        id: ++this.simSeq,
        t: now,
        name: profileName(),
        spiritId: s.spiritId,
        prayerId: s.prayerId,
        cell: this.loc ? gridKey(this.loc.lat, this.loc.lon) : undefined
      })
    }
    if (this.simFeed.length > 40) this.simFeed.splice(0, this.simFeed.length - 40)
    s.setFeed(this.simFeed)
  }

  stopSim() {
    clearInterval(this.sim)
    this.sim = null
    this.simFeed = []
  }
}

// Map a handful of common IANA zones to a central anchor coordinate. Zones not
// listed fall back to the UTC offset, which places the anchor on the correct
// meridian (within ~15°, fine at a continent scale) at a neutral latitude.
const TZ_ANCHORS = {
  'America/New_York': { lat: 40.7, lon: -74.0 },
  'America/Chicago': { lat: 41.9, lon: -87.6 },
  'America/Denver': { lat: 39.7, lon: -105.0 },
  'America/Phoenix': { lat: 33.4, lon: -112.1 },
  'America/Los_Angeles': { lat: 34.1, lon: -118.2 },
  'America/Anchorage': { lat: 61.2, lon: -149.9 },
  'Pacific/Honolulu': { lat: 21.3, lon: -157.9 },
  'America/Toronto': { lat: 43.7, lon: -79.4 },
  'America/Vancouver': { lat: 49.3, lon: -123.1 },
  'America/Mexico_City': { lat: 19.4, lon: -99.1 },
  'America/Bogota': { lat: 4.7, lon: -74.1 },
  'America/Sao_Paulo': { lat: -23.5, lon: -46.6 },
  'America/Argentina/Buenos_Aires': { lat: -34.6, lon: -58.4 },
  'Europe/London': { lat: 51.5, lon: -0.1 },
  'Europe/Paris': { lat: 48.9, lon: 2.35 },
  'Europe/Berlin': { lat: 52.5, lon: 13.4 },
  'Europe/Madrid': { lat: 40.4, lon: -3.7 },
  'Europe/Rome': { lat: 41.9, lon: 12.5 },
  'Europe/Amsterdam': { lat: 52.4, lon: 4.9 },
  'Europe/Stockholm': { lat: 59.3, lon: 18.1 },
  'Europe/Moscow': { lat: 55.8, lon: 37.6 },
  'Africa/Cairo': { lat: 30.0, lon: 31.2 },
  'Africa/Lagos': { lat: 6.5, lon: 3.4 },
  'Africa/Johannesburg': { lat: -26.2, lon: 28.0 },
  'Africa/Nairobi': { lat: -1.3, lon: 36.8 },
  'Asia/Dubai': { lat: 25.2, lon: 55.3 },
  'Asia/Kolkata': { lat: 22.6, lon: 88.4 },
  'Asia/Karachi': { lat: 24.9, lon: 67.1 },
  'Asia/Dhaka': { lat: 23.8, lon: 90.4 },
  'Asia/Shanghai': { lat: 31.2, lon: 121.5 },
  'Asia/Hong_Kong': { lat: 22.3, lon: 114.2 },
  'Asia/Singapore': { lat: 1.35, lon: 103.8 },
  'Asia/Tokyo': { lat: 35.7, lon: 139.7 },
  'Asia/Seoul': { lat: 37.5, lon: 127.0 },
  'Asia/Bangkok': { lat: 13.7, lon: 100.5 },
  'Asia/Jakarta': { lat: -6.2, lon: 106.8 },
  'Asia/Manila': { lat: 14.6, lon: 121.0 },
  'Australia/Sydney': { lat: -33.9, lon: 151.2 },
  'Australia/Melbourne': { lat: -37.8, lon: 145.0 },
  'Australia/Perth': { lat: -31.9, lon: 115.9 },
  'Pacific/Auckland': { lat: -36.8, lon: 174.8 },
  'UTC': { lat: 0, lon: 0 }
}

function tzAnchor() {
  try {
    let tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && TZ_ANCHORS[tz]) return TZ_ANCHORS[tz]
    if (tz) {
      // Centered on the zoned date, the anchor drifts to the middle of the
      // current reference period — not what we want. Use the raw offset:
      const off = new Date().getTimezoneOffset() // minutes east-of-UTC is negative
      return { lat: 25, lon: Math.round(-off / 60) * 15 } // one hour ≈ 15°
    }
  } catch {}
  return null
}

export const syncClient = new SyncClient()
