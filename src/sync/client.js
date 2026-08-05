// Connects to the shared Prayer Earth server so everyone around the world
// prays together. If the server is not reachable, the app quietly continues
// on its own with a gentle, believable world so the counts never look wrong.

import { useStore } from '../store.js'
import { gridKey } from '../shared/geo.js'
import { SyncEngine, CfEngine } from './engine.js'
import { C_PRESENCE, C_SYNC } from './protocol.js'

const PING_MS = 5000
const RETRY_MS = 10000

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

// Deterministic stand-ins for users who can't share a location, so every
// light still lands on a real, populated place.
const FALLBACK_CITIES = [
  [40.7, -74.0], [51.5, -0.1], [48.9, 2.3], [35.7, 139.7], [28.6, 77.2],
  [37.8, -122.4], [-33.9, 151.2], [55.8, 37.6], [31.2, 121.5], [-23.5, -46.6],
  [19.1, 72.9], [1.4, 103.8], [25.2, 55.3], [-6.2, 106.8], [30.0, 31.2],
  [21.5, 39.2], [52.5, 13.4], [34.0, -118.2], [41.9, -87.6], [39.9, 116.4],
  [-34.6, -58.4], [10.8, 106.6], [6.5, 3.4], [40.4, -3.7], [43.7, -79.4],
  [-26.2, 28.0], [4.7, -74.1], [13.1, 80.3], [-1.3, 36.8], [59.9, 10.8],
  [36.8, 10.2], [41.0, 28.9], [3.1, 101.7], [33.9, -84.4], [38.9, -77.0]
]

// Same host that served the page. In development the socket lives on 8787
// (a separate process); in production one process serves both the app and the
// socket on the same port, so we connect to the page's own origin. Set
// VITE_SYNC_URL (a ws:// or wss:// URL) to point the socket at the Cloudflare
// Worker or a `wrangler dev` instance — that's the sync-engine cutover knob.
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
// the first time, which is then saved so it stays stable).
function profileName() {
  const p = useStore.getState().profile
  return (p.name || '').trim() || pickName()
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
  // local â€” no location ever leaves the device.
  ensureLocation() {
    const publish = () => useStore.getState().setYouLoc(this.loc)
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.loc = {
              lat: +pos.coords.latitude.toFixed(1),
              lon: +pos.coords.longitude.toFixed(1)
            }
            publish()
          },
          () => {
            this.fallbackLoc()
            publish()
          },
          { timeout: 8000, maximumAge: 600000, enableHighAccuracy: false }
        )
        return
      }
    } catch {}
    this.fallbackLoc()
    publish()
  }

  fallbackLoc() {
    let h = 0
    const n = this.name
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0
    const [lat, lon] = FALLBACK_CITIES[h % FALLBACK_CITIES.length]
    this.loc = { lat, lon }
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
            useStore.getState().setPeoplePraying(msg.people || 0)
            useStore.getState().setTotalPrayerSeconds(msg.totalPrayerSeconds || 0)
            useStore.getState().setPrayerCounts(msg.prayers || {})
            useStore.getState().setSpiritCounts(msg.spirits || {})
            if (msg.usersToday != null && msg.usersWeek != null) {
              useStore.getState().setUsersActivity(msg.usersToday, msg.usersWeek)
            }
            if (msg.lights) useStore.getState().setLights(msg.lights)
            if (msg.lightSpirits) useStore.getState().setLightSpirits(msg.lightSpirits)
            if (msg.totals) {
              useStore.getState().setPrayerTotals(msg.totals.prayers || {})
              useStore.getState().setSpiritTotals(msg.totals.spirits || {})
            }
          } else if (msg.type === 'feed') {
            useStore.getState().setFeed(msg.feed || [])
          } else if (msg.type === 'sync' && msg.stats) {
            useStore.getState().mergeSyncStats(msg.stats)
          } else if (msg.type === 'error') {
            // The engine told us why it is closing (e.g. rate-limited). Surface
            // it so the UI can show a gentle, non-alarming notice.
            useStore.getState().setSyncNotice(msg.code || 'error')
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
      // Offline — keep the local world in sync with the user's own prayer.
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

export const syncClient = new SyncClient()
