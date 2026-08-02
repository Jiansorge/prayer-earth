// Connects to the shared Prayer Earth server so everyone around the world
// prays together. If the server is not reachable, the app quietly continues
// on its own with a gentle, believable world so the counts never look wrong.

import { useStore } from '../store.js'

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

// Rounds onto the shared 2-degree light grid the server uses too, so a light
// shows at exactly the same cell in offline (sim) and online modes.
function lightKey(lat, lon) {
  const la = Math.max(-60, Math.min(72, Math.round(lat / 2) * 2))
  let lo = Math.round(lon / 2) * 2
  if (lo >= 180) lo = -180
  return `${la},${lo}`
}

// Same host that served the page, port 8787 by default — so a phone on the
// same network as the server joins the shared prayer. Override in production.
function defaultUrl() {
  const host = window.location.hostname || 'localhost'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
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

const SIM_FEED_NAMES = ['Lotus', 'Noor', 'River', 'Kavi', 'Amara', 'Rumi', 'Mei', 'Pax']

class SyncClient {
  constructor() {
    this.sock = null
    this.retry = null
    this.ping = null
    this.mode = 'sim'
    this.name = pickName()
    this.loc = null
  }

  start() {
    this.stop()
    this.ensureLocation()
    this.connect()
  }

  // Ask once for a coarse location so the world can show a light where you
  // are. If it's not granted or available, fall back to a stable stand-in
  // city so your prayer still lands somewhere on the map.
  ensureLocation() {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.loc = {
              lat: +pos.coords.latitude.toFixed(1),
              lon: +pos.coords.longitude.toFixed(1)
            }
          },
          () => this.fallbackLoc(),
          { timeout: 8000, maximumAge: 600000, enableHighAccuracy: false }
        )
        return
      }
    } catch {}
    this.fallbackLoc()
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
    if (this.sock) {
      this.sock.onopen = null
      this.sock.onmessage = null
      this.sock.onclose = null
      try {
        this.sock.close()
      } catch {}
      this.sock = null
    }
    this.stopSim()
  }

  connect() {
    try {
      const ws = new WebSocket(DEFAULT_URL)
      this.sock = ws
      ws.onopen = () => {
        this.stopSim()
        this.mode = 'live'
        useStore.getState().setConnected(true)
        this.sendPresence()
        this.ping = setInterval(() => this.sendPresence(), PING_MS)
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'state') {
            useStore.getState().setPeoplePraying(msg.people || 0)
            useStore.getState().setTotalPrayerSeconds(msg.totalPrayerSeconds || 0)
            useStore.getState().setPrayerCounts(msg.prayers || {})
            useStore.getState().setSpiritCounts(msg.spirits || {})
            if (msg.lights) useStore.getState().setLights(msg.lights)
            if (msg.totals) {
              useStore.getState().setPrayerTotals(msg.totals.prayers || {})
              useStore.getState().setSpiritTotals(msg.totals.spirits || {})
            }
          } else if (msg.type === 'feed') {
            useStore.getState().setFeed(msg.feed || [])
          }
        } catch {}
      }
      ws.onclose = () => {
        this.mode = 'sim'
        useStore.getState().setConnected(false)
        this.startSim()
        this.scheduleRetry()
      }
      ws.onerror = () => {
        try {
          ws.close()
        } catch {}
      }
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
    if (this.mode !== 'live' || !this.sock || this.sock.readyState !== WebSocket.OPEN) {
      // Offline — keep the local world in sync with the user's own prayer.
      if (this.mode === 'sim' && this.sim) this.simState()
      return
    }
    this.sock.send(
      JSON.stringify({
        type: 'presence',
        praying: s.praying,
        prayerId: s.praying ? s.prayerId : null,
        spiritId: s.praying ? s.spiritId : null,
        name: this.name,
        lat: this.loc ? this.loc.lat : null,
        lon: this.loc ? this.loc.lon : null
      })
    )
  }

  presenceNow() {
    this.sendPresence()
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
    seed.forEach(([sp, pr], i) => {
      this.simFeed.push({
        id: i + 1,
        t: now - (i + 2) * 60000,
        name: SIM_FEED_NAMES[i],
        spiritId: sp,
        prayerId: pr
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
    const addLight = (lat, lon) => {
      if (typeof lat !== 'number' || typeof lon !== 'number') return
      const k = lightKey(lat, lon)
      lights[k] = (lights[k] || 0) + 1
    }
    for (const [sp, pr, lat, lon] of SIM_PEOPLE) {
      prayers[pr] = (prayers[pr] || 0) + 1
      spirits[sp] = (spirits[sp] || 0) + 1
      addLight(lat, lon)
    }
    // Always count the person praying right here.
    if (s.praying && s.spiritId && s.prayerId) {
      prayers[s.prayerId] = (prayers[s.prayerId] || 0) + 1
      spirits[s.spiritId] = (spirits[s.spiritId] || 0) + 1
    }
    if (this.loc) addLight(this.loc.lat, this.loc.lon)
    const total = Object.values(spirits).reduce((a, b) => a + b, 0)
    s.setPeoplePraying(total)
    s.setPrayerCounts(prayers)
    s.setSpiritCounts(spirits)
    s.setLights(lights)
    s.setTotalPrayerSeconds(s.totalPrayerSeconds + 1.5)

    // A gentle trickle of "now praying" entries, including the person here.
    const now = Date.now()
    if (!s.praying && Math.random() < 0.35) {
      const [sp, pr] = SIM_PEOPLE[Math.floor(Math.random() * SIM_PEOPLE.length)]
      this.simFeed.push({
        id: ++this.simSeq,
        t: now,
        name: SIM_FEED_NAMES[Math.floor(Math.random() * SIM_FEED_NAMES.length)],
        spiritId: sp,
        prayerId: pr
      })
    }
    if (s.praying && s.spiritId && s.prayerId && this.lastSimSelf !== now) {
      this.lastSimSelf = now
      this.simFeed.push({
        id: ++this.simSeq,
        t: now,
        name: this.name,
        spiritId: s.spiritId,
        prayerId: s.prayerId
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
