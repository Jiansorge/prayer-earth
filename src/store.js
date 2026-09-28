import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { prayerBaseTotals, spiritBaseTotals } from './data/totals.js'
import { mergeStats } from './shared/stats.js'
import { AMBIENT_PRESETS, DEFAULT_AMBIENT_PRESET } from './audio/presets.js'

// Cheap shallow equality for objects/arrays â€” skips Zustand subscriber
// notifications when the values haven't actually changed. Used on the
// high-frequency sync setters so presence ticks that carry unchanged
// counts don't trigger cascading re-renders across every subscriber.
const safeCounter = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0)
const safeStringMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [key, entry] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue
    if (typeof key === 'string' && typeof entry === 'string') out[key] = entry.slice(0, 200)
  }
  return out
}
const safeCounterMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [key, count] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue
    if (typeof key === 'string' && key.length <= 100) out[key] = safeCounter(count)
  }
  return out
}
// How many days of per-day history we retain. Must be comfortably larger than a
// realistic streak, because the current streak is DERIVED by walking this map
// back from today â€” a cap below the streak length would silently under-report
// it. 120 days (~4 months) leaves ample payload headroom while representing any
// realistic streak.
const DAY_MAP_LIMIT = 120
const safeDayMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [day, counts] of Object.entries(value).sort().slice(-DAY_MAP_LIMIT)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    const clean = safeCounterMap(counts)
    if (Object.keys(clean).length) out[day] = clean
  }
  return out
}

const mergeCountMap = (base, incoming) => {
  const out = { ...(base || {}) }
  for (const [k, v] of Object.entries(incoming || {})) {
    out[k] = Math.max(out[k] || 0, Number(v) || 0)
  }
  return out
}

const eq = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (a[k] !== b[k]) return false
  return true
}

// Storage that can never break the app. In private modes, sandboxed iframes,
// or when a quota is exceeded, localStorage access throws, and prayer state
// (especially the per-second counters) writes constantly. Swallow those errors
// and keep running in memory; persistence silently degrades.
const safeStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  // Persisting on every set() meant the prayer clock wrote the whole payload to
  // localStorage ~3x/second. We do NOT debounce these writes: a hard kill (adb
  // force-stop, OS process death) fires no pagehide/visibilitychange, so a
  // pending debounced write would be LOST â€” a small but real decrease in the
  // user's prayer seconds on relaunch. Durability wins: writes stay synchronous.
  // (Write VOLUME is instead reduced by batching the clock into one set()/tick â€”
  // see tickPrayerClock â€” and day maps are bounded, so quota is not a risk.)
  // A write failure is latched + surfaced so silent loss can't go unnoticed.
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      if (!_writeFailed) {
        _writeFailed = true
        // Tell the user their counts are not being saved, rather than letting
        // them pray for weeks and lose it silently.
        try {
          useStore.setState({ persistFailed: true })
        } catch {}
      }
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {}
  }
}

let _writeFailed = false

const dayKey = (t) =>
  `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate()
  ).padStart(2, '0')}`

// Locale codes the app ships, in the same order as src/i18n.js LOCALES. Kept
// here (instead of imported) because i18n.js imports this store â€” a circular
// import â€” and only the codes are needed for matching the browser language.
const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi', 'vi', 'tl', 'bo']

// Map browser language tags that don't use our base code to the closest locale
// (Filipinoâ†’tl, zh variantsâ†’zh, pt-BR/pt-PTâ†’pt). Anything else matches by its
// first subtag (es-MXâ†’es, fr-CAâ†’fr, hi-INâ†’hi).
const LOCALE_ALIASES = {
  'fil': 'tl',
  'fil-ph': 'tl',
  'tag': 'tl',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
  'zh-sg': 'zh',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  'pt-ao': 'pt',
  'pt-mz': 'pt'
}

// Starting language for the very first run, before any manual choice exists:
// match the browser's preferred languages to a supported locale, falling back
// to English. A returning user keeps their pick because the persisted store
// overwrites this initial value when it hydrates.
function detectInitialLocale() {
  if (typeof navigator === 'undefined') return 'en'
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language || 'en']
  for (let raw of preferred) {
    const tag = String(raw).toLowerCase().replace('_', '-')
    if (LOCALE_ALIASES[tag]) return LOCALE_ALIASES[tag]
    const base = tag.split('-')[0]
    if (SUPPORTED_LOCALES.includes(base)) return base
  }
  return 'en'
}

export const useStore = create(
  persist(
    (set, get) => ({
      view: 'home',
      legalPage: null,
      legalReturn: null,
      localeReady: 0,
      spiritId: null,
      prayerId: null,
      praying: false,
      playing: false,
      paused: false,
      pendingPlay: false,
      // which prayer is actually producing audio right now (so the footer and
      // other pages know what's playing even when viewing a different prayer)
      playingPrayerId: null,
      playingSpiritId: null,
      playingSessionId: null,
      // the phrase index the playing prayer is on, so the highlight survives
      // leaving and returning to the prayer page
      currentPhrase: null,
      // last time a full prayer completed on this device (ms), drives the
      // gentle "your prayer is carried" toast
      completedAt: 0,
      // seconds of the current playback, kept in the store so it keeps ticking
      // while the prayer page is not on screen
      elapsed: 0,
      settingsOpen: false,
      keyboardHelpOpen: false,
      setKeyboardHelpOpen: (keyboardHelpOpen) => set({ keyboardHelpOpen }),
      prayerPickerSpiritId: null,

      // global sync
  connected: false,
  syncNotice: null,
  // Set when a localStorage write fails, so the UI can warn that counts aren't
  // being saved (see safeStorage.setItem).
  persistFailed: false,
      // when the shared world was first launched (ms epoch), so the glow can
      // show a gentle floor on day one and be fully honest afterwards
      startedAt: null,
      // this device's first run (ms epoch), the fallback birthday when the
      // engine doesn't report a server startedAt
      firstSeen: 0,
      peoplePraying: 0,
      totalPrayerSeconds: 0,
          prayerCounts: {},
      spiritCounts: {},
      lights: {},
      lightSpirits: {},
      feed: [],
      // how many people prayed today / this week (drives the Earth's glow)
      usersToday: 0,
      usersWeek: 0,
      // where you are on the Earth, so the map can mark you
      youLoc: null,

      // who you are on the Earth: a sacred name, a nature avatar, a light
      profile: { name: '', avatar: 'ðŸŒ¿', color: '#7fc9a0' },

      localPrayerSeconds: 0,
      loopOn: true,
      voiceURI: null,
      // per-prayer static voice choice (keys are prayer ids, values are voice ids)
      prayerVoices: {},
      speechRate: 0.85,
      ambienceLevel: 0.7,
  ambientPreset: DEFAULT_AMBIENT_PRESET,
      volume: 0.5,
      muted: false,
      lastVolume: 0.5,
      locale: detectInitialLocale(),
      theme: 'space',

      // collective all-time totals (from the server)
      prayerTotals: {},
      spiritTotals: {},

      // this person's own recitations, persisted and synced separately
      prayerCompletions: {},
      prayerDayCompletions: {},
      // per-prayer seconds, bucketed by UTC day: { 'YYYY-MM-DD': { prayerId: secs } }
      prayerDayStats: {},
      // ids of prayers the person wants close to hand
      favorites: [],

      // daily streak
      streak: 0,
      bestStreak: 0,
      lastPrayedDay: null,
      celebrateStreak: 0,

      // An opaque browser-profile id for private, server-side lifetime sync.
      anonId: '',

      // ---- navigation ----
      go: (view) =>
        set((s) => {
          if (view === 'prayer' && !s.spiritId) {
            return { view, spiritId: 'christianity', prayerId: 'lords-prayer' }
          }
          return { view }
        }),
      openPrayer: (spiritId, prayerId) =>
        set({ view: 'prayer', spiritId, prayerId }),
      openLegal: (legalPage) =>
        set((s) => ({
          view: 'legal',
          legalPage,
          // Remember where the legal page was opened from (it is only reachable
          // from the Settings sheet) so Back returns to that sheet instead of
          // dumping the user on the home screen.
          legalReturn: { view: s.view, settingsOpen: s.settingsOpen },
          settingsOpen: false
        })),
      closeLegal: () =>
        set((s) =>
          s.legalReturn
            ? {
                view: s.legalReturn.view,
                legalPage: null,
                settingsOpen: s.legalReturn.settingsOpen,
                legalReturn: null
              }
            : { view: 'home', legalPage: null }
        ),
      closePrayer: () => set({ view: 'home', praying: false, pendingPlay: false }),
      openPrayerPicker: (spiritId) => set({ prayerPickerSpiritId: spiritId }),
      closePrayerPicker: () => set({ prayerPickerSpiritId: null }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

      setPraying: (praying) => set({ praying }),
      setPlaying: (playing) => set({ playing }),
      setPaused: (paused) => set({ paused }),
      setPendingPlay: (pendingPlay) => set({ pendingPlay }),
      setPlayingPrayerId: (playingPrayerId) => set({ playingPrayerId }),
      setPlayingSpiritId: (playingSpiritId) => set({ playingSpiritId }),
      setPlayingSessionId: (playingSessionId) => set({ playingSessionId }),
      setElapsed: (elapsed) => set({ elapsed }),
      setCurrentPhrase: (currentPhrase) => set({ currentPhrase }),
      setCompletedAt: (completedAt) => set({ completedAt }),
      setLoopOn: (loopOn) => set({ loopOn }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setPrayerVoice: (prayerId, voiceId) =>
        set((s) => ({ prayerVoices: { ...s.prayerVoices, [prayerId]: voiceId } })),
      toggleFavorite: (prayerId) =>
        set((s) => ({
          favorites: s.favorites.includes(prayerId)
            ? s.favorites.filter((id) => id !== prayerId)
            : [...s.favorites, prayerId]
        })),
      isFavorite: (prayerId) => get().favorites.includes(prayerId),
      setSpeechRate: (speechRate) => set({ speechRate }),
      setAmbienceLevel: (ambienceLevel) => set({ ambienceLevel }),
  setAmbientPreset: (ambientPreset) => set({ ambientPreset }),
      setVolume: (volume) => set({ volume }),
      setLocale: (locale) => set({ locale }),
      bumpLocaleReady: () => set((s) => ({ localeReady: s.localeReady + 1 })),
      setTheme: (theme) => set({ theme }),

      // ---- sync ----
      setConnected: (connected) => set({ connected }),
      // A transient, non-blocking notice when the engine tells us why it closed
      // a connection (e.g. 'rate'). Null when all is well.
      setSyncNotice: (syncNotice) => set({ syncNotice }),
      setPeoplePraying: (peoplePraying) => set({ peoplePraying }),
      setPrayerCounts: (prayerCounts) =>
        set((s) => eq(s.prayerCounts, prayerCounts) ? {} : { prayerCounts }),
      setSpiritCounts: (spiritCounts) =>
        set((s) => eq(s.spiritCounts, spiritCounts) ? {} : { spiritCounts }),
      setLights: (lights) =>
        set((s) => eq(s.lights, lights) ? {} : { lights }),
      setLightSpirits: (lightSpirits) =>
        set((s) => eq(s.lightSpirits, lightSpirits) ? {} : { lightSpirits }),
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setPrayerTotals: (prayerTotals) =>
        set((s) => {
          const next = mergeCountMap(s.prayerTotals, prayerTotals)
          return eq(s.prayerTotals, next) ? {} : { prayerTotals: next }
        }),
      setSpiritTotals: (spiritTotals) =>
        set((s) => {
          const next = mergeCountMap(s.spiritTotals, spiritTotals)
          return eq(s.spiritTotals, next) ? {} : { spiritTotals: next }
        }),
      setFeed: (feed) => set({ feed }),
      setYouLoc: (youLoc) => set({ youLoc }),
      setUsersActivity: (usersToday, usersWeek) => set({ usersToday, usersWeek }),
      setStartedAt: (startedAt) => set({ startedAt }),
      setFirstSeen: (firstSeen) => set({ firstSeen }),
      setTotalPrayerSeconds: (value) =>
        set((s) => ({
          totalPrayerSeconds: Math.max(s.totalPrayerSeconds, Number(value) || 0)
        })),
      addLocalPrayer: (seconds) =>
        set((s) => ({
          localPrayerSeconds: s.localPrayerSeconds + seconds
        })),

      // Credit one clock tick's prayer time in a SINGLE set() (cumulative
      // seconds, today's chart, and the elapsed readout together). The clock used
      // to call three separate actions per tick, so every second wrote the whole
      // persisted payload to localStorage three times; batching cuts that to one
      // synchronous, durable write per tick.
      tickPrayerClock: (seconds, prayerId) =>
        set((s) => {
          const upd = {
            localPrayerSeconds: s.localPrayerSeconds + seconds,
            elapsed: s.elapsed + seconds
          }
          if (prayerId) {
            const key = dayKey(new Date())
            const day = s.prayerDayStats[key] ? { ...s.prayerDayStats[key] } : {}
            day[prayerId] = (day[prayerId] || 0) + seconds
            const stats = { ...s.prayerDayStats, [key]: day }
            const keys = Object.keys(stats).sort()
            if (keys.length > DAY_MAP_LIMIT) {
              for (let i = 0; i < keys.length - DAY_MAP_LIMIT; i++) delete stats[keys[i]]
            }
            upd.prayerDayStats = stats
          }
          return upd
        }),

      // One full cycle of a prayer finished, count it toward the all-time total.
      notePrayerComplete: (prayerId) =>
        set((s) => {
          const key = dayKey(new Date())
          const day = s.prayerDayCompletions[key]
            ? { ...s.prayerDayCompletions[key] }
            : {}
          day[prayerId] = (day[prayerId] || 0) + 1
          const days = { ...s.prayerDayCompletions, [key]: day }
          const keys = Object.keys(days).sort()
          if (keys.length > DAY_MAP_LIMIT) {
            for (let i = 0; i < keys.length - DAY_MAP_LIMIT; i++) delete days[keys[i]]
          }
          return {
            prayerCompletions: {
              ...s.prayerCompletions,
              [prayerId]: (s.prayerCompletions[prayerId] || 0) + 1
            },
            prayerDayCompletions: days
          }
        }),

      // Attribute one prayed second to this prayer on the current UTC day.
      addPrayerSecond: (prayerId, seconds = 1) =>
        set((s) => {
          if (!prayerId) return {}
          const key = dayKey(new Date())
          const day = s.prayerDayStats[key] ? { ...s.prayerDayStats[key] } : {}
          day[prayerId] = (day[prayerId] || 0) + seconds
          const stats = { ...s.prayerDayStats, [key]: day }
          // Bound the history so it never grows without end.
          const keys = Object.keys(stats).sort()
          if (keys.length > DAY_MAP_LIMIT) {
            for (let i = 0; i < keys.length - DAY_MAP_LIMIT; i++) delete stats[keys[i]]
          }
          return { prayerDayStats: stats }
        }),

      // Called when a full prayer cycle completes; idempotent per day.
      markPrayedToday: () => {
        const d = new Date()
        const key = (t) =>
          `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
            t.getUTCDate()
          ).padStart(2, '0')}`
        const today = key(d)
        const y = new Date(d)
        y.setUTCDate(d.getUTCDate() - 1)
        const yesterday = key(y)
        set((s) => {
          if (s.lastPrayedDay === today) return {}
          const streak = s.lastPrayedDay === yesterday ? s.streak + 1 : 1
          return {
            streak,
            bestStreak: Math.max(s.bestStreak, streak),
            lastPrayedDay: today,
            // One-shot signal the UI reads to celebrate a kept streak.
            celebrateStreak: streak >= 2 ? streak : 0
          }
        })
      },
      clearCelebration: () => set({ celebrateStreak: 0 }),

      // ---- anonymous sync ----

      // Create (once) and remember an opaque id so stats can follow the person
      // across devices without ever revealing who they are.
      getAnonId: () => {
        const s = get()
        if (s.anonId) return s.anonId
        let id = ''
        try {
          if (crypto && typeof crypto.randomUUID === 'function') id = crypto.randomUUID()
        } catch {}
        if (!id) {
          id = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
        }
        set({ anonId: id })
        return id
      },

      // The lifetime stats that are safe to sync: pure counters, nothing about
      // who or where you are.
      getSyncStats: () => {
        const s = get()
        return {
          prayerCompletions: s.prayerCompletions,
          prayerDayCompletions: s.prayerDayCompletions,
          // prayerDayStats is deliberately NOT synced: it is ~46% of the frame,
          // the server uses it for nothing functional (active-day checks read
          // prayerDayCompletions + lastPrayedDay), and including it pushed the
          // sync message past MAX_WS_MSG at ~13 distinct prayers/day, which
          // silently broke lifetime sync (socket closed as 'too-large'). It stays
          // in the local store + partialize. (hasLifetimeStats stays safe because
          // localPrayerSeconds and prayerDayCompletions always accompany it.)
          localPrayerSeconds: s.localPrayerSeconds,
          streak: s.streak,
          bestStreak: s.bestStreak,
          lastPrayedDay: s.lastPrayedDay
        }
      },

      // Fold server-side stats back in, taking the greater of each counter so
      // two devices can never lose a prayer.
      mergeSyncStats: (stats) => {
        if (!stats) return
        const s = get()
        const merged = mergeStats(s, stats)
        set({
          prayerCompletions: merged.prayerCompletions,
          prayerDayCompletions: merged.prayerDayCompletions,
          prayerDayStats: merged.prayerDayStats,
          localPrayerSeconds: merged.localPrayerSeconds,
          streak: merged.streak,
          bestStreak: merged.bestStreak,
          lastPrayedDay: merged.lastPrayedDay
        })
      },

      // ---- derived ----
      // Cumulative all-time prayer starts. The shared server is authoritative;
      // personal recitation counters are kept separate and persisted locally.
      getPrayerCount: () => {
        const s = get()
        return (
          Object.values(prayerBaseTotals).reduce((a, b) => a + (b || 0), 0) +
          Object.values(s.prayerTotals).reduce((a, b) => a + (b || 0), 0)
        )
      },
      // How alight the Earth is, shown as a percentage of a million prayers
      // prayed together. It is driven ONLY by cumulative all-time prayers
      // (server totals), which never decrease, so the number and the Earth's
      // glow can only ever climb. The curve is
      // gentle: it reads small at first and rises slowly, reaching 100% at the
      // million-prayer mark.
      getGlow: () => {
        const s = get()
        const prayers = s.getPrayerCount()
        return Math.min(1, Math.pow(prayers / 1_000_000, 0.38))
      },
      // The honest share of a million prayers (linear, not the eased curve used
      // for the Earth's visual glow), so the % text always means what it says.
      getGlowPercent: () =>
        Math.min(100, (get().getPrayerCount() / 1_000_000) * 100),
      getEarthBrightness: () => {
        const glow = get().getGlow()
        return 0.16 + glow * 0.84
      },

      // All-time count of a prayer ever carried: believable base + the shared
      // server's real count.
      getPrayerTotal: (prayerId) => {
        const s = get()
        return (
          (prayerBaseTotals[prayerId] || 0) +
          (s.prayerTotals[prayerId] || 0)
        )
      },
      // How many times this prayer was recited today (per-repetition for mantras).
      getPrayerToday: (prayerId) => {
        const key = dayKey(new Date())
        return get().prayerDayCompletions[key]?.[prayerId] || 0
      },
      // Sum of all your recitations today across every prayer.
      getYourToday: () => {
        const s = get()
        const key = dayKey(new Date())
        const d = s.prayerDayCompletions[key]
        if (!d) return 0
        return Object.values(d).reduce((a, b) => a + b, 0)
      },
      getSpiritTotal: (spiritId) => {
        const s = get()
        return (spiritBaseTotals[spiritId] || 0) + (s.spiritTotals[spiritId] || 0)
      }
    }),
    {
      name: 'prayer-earth-v1',
      storage: createJSONStorage(() => safeStorage),
      version: 2,
      migrate: (state) => state,
      merge: (persisted, current) => {
        const saved = persisted && typeof persisted === 'object' ? { ...persisted } : {}
        delete saved.offlineQueue
        return {
          ...current,
          ...saved,
          profile: {
            ...current.profile,
            ...(saved.profile && typeof saved.profile === 'object' && !Array.isArray(saved.profile)
              ? saved.profile
              : {})
          },
          favorites: Array.isArray(saved.favorites) ? saved.favorites : current.favorites,
          prayerVoices: safeStringMap(saved.prayerVoices),
          prayerCompletions: safeCounterMap(saved.prayerCompletions),
          prayerTotals: safeCounterMap(saved.prayerTotals),
          spiritTotals: safeCounterMap(saved.spiritTotals),
          prayerDayCompletions: safeDayMap(saved.prayerDayCompletions),
          prayerDayStats: safeDayMap(saved.prayerDayStats),
          // A duration, not a count: floor rather than requiring an integer so a
          // fractional persisted value is never silently zeroed on every boot.
          localPrayerSeconds: Math.max(0, Math.floor(Number(saved.localPrayerSeconds) || 0)),
          streak: safeCounter(saved.streak),
          bestStreak: safeCounter(saved.bestStreak),
          speechRate: Math.max(0.6, Math.min(2, Number(saved.speechRate) || current.speechRate)),
    ambienceLevel:
      saved.ambienceLevel == null
        ? current.ambienceLevel
        : Math.max(0, Math.min(1, Number(saved.ambienceLevel) || 0)),
    ambientPreset: AMBIENT_PRESETS.includes(saved.ambientPreset)
      ? saved.ambientPreset
      : current.ambientPreset,
          volume:
            saved.volume == null ? current.volume : Math.max(0, Math.min(1, Number(saved.volume) || 0)),
          muted: !!saved.muted
        }
      },
      partialize: (s) => ({
        spiritId: s.spiritId,
        prayerId: s.prayerId,
        localPrayerSeconds: s.localPrayerSeconds,
        loopOn: s.loopOn,
        voiceURI: s.voiceURI,
        prayerVoices: s.prayerVoices,
        favorites: s.favorites,
        speechRate: s.speechRate,
        ambienceLevel: s.ambienceLevel,
    ambientPreset: s.ambientPreset,
        volume: s.volume,
        muted: s.muted,
        lastVolume: s.lastVolume,
        locale: s.locale,
        theme: s.theme,
        profile: s.profile,
        prayerCompletions: s.prayerCompletions,
        prayerDayCompletions: s.prayerDayCompletions,
        prayerDayStats: s.prayerDayStats,
        // Last-known shared world totals, so the "all time" numbers, the glow
        // and "share of a million prayers" still render while offline instead
        // of reading 0. They are max-merged (setPrayerTotals -> mergeCountMap)
        // so a stale cached value can only ever be climbed, never lowered.
        prayerTotals: s.prayerTotals,
        spiritTotals: s.spiritTotals,
        streak: s.streak,
        bestStreak: s.bestStreak,
        lastPrayedDay: s.lastPrayedDay,
        anonId: s.anonId,
        firstSeen: s.firstSeen,
      })
    }
  )
)

if (
  import.meta.env?.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('peTest') === '1')
) {
  window.__store = useStore
}

// The prayer clock lives here (not on the prayer page) so a prayer keeps being
// counted toward the world totals even while you browse Home or the Earth with
// it playing in the background. No-ops whenever nothing is playing.
//
// Credited by WALL CLOCK, not tick count: a backgrounded tab/OS can throttle or
// freeze setInterval, which used to under-count a background prayer (audio kept
// playing off Date.now() while the counter barely ticked) â€” a permanent, invisible
// loss of the user's most sacred number. We credit the real elapsed delta on each
// tick and on visibility/pagehide, capped so a long device sleep can't fabricate
// hours of prayer either.
let _lastTickAt = 0
const MAX_CREDIT_PER_FLUSH = 30 // seconds a single flush may credit
function creditPrayerClock() {
  const s = useStore.getState()
  const now = Date.now()
  if (!s.playing || s.paused) {
    _lastTickAt = now
    return
  }
  if (!_lastTickAt) {
    _lastTickAt = now
    return
  }
  const delta = Math.min(MAX_CREDIT_PER_FLUSH, Math.max(1, Math.round((now - _lastTickAt) / 1000)))
  _lastTickAt = now
  s.tickPrayerClock(delta, s.playingPrayerId)
}
setInterval(creditPrayerClock, 1000)
// Flush the real delta when the tab is hidden or closed (the interval may not
// fire again for a while once backgrounded).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) creditPrayerClock()
    else creditPrayerClock()
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', creditPrayerClock)
  }
}

