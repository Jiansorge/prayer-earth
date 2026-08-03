import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { prayerBaseTotals, spiritBaseTotals } from './data/totals.js'
import { SPIRITUALITY_BY_ID } from './data/prayers.js'

const TOTAL_TO_FULL = 3600 // seconds of collective prayer to fully light the Earth

const dayKey = (t) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate()
  ).padStart(2, '0')}`

export const useStore = create(
  persist(
    (set, get) => ({
      view: 'home',
      legalPage: null,
      spiritId: null,
      prayerId: null,
      praying: false,
      playing: false,
      paused: false,
      pendingPlay: false,
      settingsOpen: false,
      prayerPickerSpiritId: null,

      // global sync
      connected: false,
      peoplePraying: 0,
      totalPrayerSeconds: 0,
      basePrayerSeconds: 0,
      prayerCounts: {},
      spiritCounts: {},
      lights: {},
      lightSpirits: {},
      feed: [],
      // where you are on the Earth, so the map can mark you
      youLoc: null,

      // who you are on the Earth: a sacred name, a nature avatar, a light
      profile: { name: '', avatar: '🌿', color: '#7fc9a0' },

      localPrayerSeconds: 0,
      loopOn: true,
      voiceURI: null,
      // per-prayer static voice choice (keys are prayer ids, values are voice ids)
      prayerVoices: {},
      speechRate: 0.85,
      ambienceLevel: 0.7,
      volume: 0.5,
      locale: 'en',
      theme: 'mystic',

      // collective all-time totals (from the server)
      prayerTotals: {},
      spiritTotals: {},

      // this person's own contributions to the all-time counts
      prayerCompletions: {},
      prayerDayCompletions: {},

      // per-prayer seconds, bucketed by local day: { 'YYYY-MM-DD': { prayerId: secs } }
      prayerDayStats: {},

      // daily streak
      streak: 0,
      bestStreak: 0,
      lastPrayedDay: null,
      celebrateStreak: 0,

      // a random, anonymous id so your lifetime stats can follow you between
      // devices — no account, no name, just an opaque token
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
      openLegal: (legalPage) => set({ view: 'legal', legalPage }),
      closeLegal: () => set({ view: 'home', legalPage: null }),
      closePrayer: () => set({ view: 'home', praying: false }),
      openPrayerPicker: (spiritId) => set({ prayerPickerSpiritId: spiritId }),
      closePrayerPicker: () => set({ prayerPickerSpiritId: null }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

      setPraying: (praying) => set({ praying }),
      setPlaying: (playing) => set({ playing }),
      setPaused: (paused) => set({ paused }),
      setPendingPlay: (pendingPlay) => set({ pendingPlay }),
      setLoopOn: (loopOn) => set({ loopOn }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setPrayerVoice: (prayerId, voiceId) =>
        set((s) => ({ prayerVoices: { ...s.prayerVoices, [prayerId]: voiceId } })),
      setSpeechRate: (speechRate) => set({ speechRate }),
      setAmbienceLevel: (ambienceLevel) => set({ ambienceLevel }),
      setVolume: (volume) => set({ volume }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),

      // ---- sync ----
      setConnected: (connected) => set({ connected }),
      setPeoplePraying: (peoplePraying) => set({ peoplePraying }),
      setPrayerCounts: (prayerCounts) => set({ prayerCounts }),
      setSpiritCounts: (spiritCounts) => set({ spiritCounts }),
      setLights: (lights) => set({ lights }),
      setLightSpirits: (lightSpirits) => set({ lightSpirits }),
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setPrayerTotals: (prayerTotals) => set({ prayerTotals }),
      setSpiritTotals: (spiritTotals) => set({ spiritTotals }),
      setFeed: (feed) => set({ feed }),
      setYouLoc: (youLoc) => set({ youLoc }),
      setTotalPrayerSeconds: (totalPrayerSeconds) =>
        set((s) => ({
          totalPrayerSeconds,
          basePrayerSeconds: Math.max(s.basePrayerSeconds, totalPrayerSeconds)
        })),
      addLocalPrayer: (seconds) =>
        set((s) => ({
          localPrayerSeconds: s.localPrayerSeconds + seconds
        })),

      // One full cycle of a prayer finished — count it toward the all-time total.
      notePrayerComplete: (prayerId) =>
        set((s) => {
          const key = dayKey(new Date())
          const day = s.prayerDayCompletions[key]
            ? { ...s.prayerDayCompletions[key] }
            : {}
          day[prayerId] = (day[prayerId] || 0) + 1
          const days = { ...s.prayerDayCompletions, [key]: day }
          const keys = Object.keys(days).sort()
          if (keys.length > 62) {
            for (let i = 0; i < keys.length - 62; i++) delete days[keys[i]]
          }
          return {
            prayerCompletions: {
              ...s.prayerCompletions,
              [prayerId]: (s.prayerCompletions[prayerId] || 0) + 1
            },
            prayerDayCompletions: days
          }
        }),

      // Attribute one prayed second to this prayer on the current local day.
      addPrayerSecond: (prayerId) =>
        set((s) => {
          if (!prayerId) return {}
          const key = dayKey(new Date())
          const day = s.prayerDayStats[key] ? { ...s.prayerDayStats[key] } : {}
          day[prayerId] = (day[prayerId] || 0) + 1
          const stats = { ...s.prayerDayStats, [key]: day }
          // Bound the history so it never grows without end.
          const keys = Object.keys(stats).sort()
          if (keys.length > 62) {
            for (let i = 0; i < keys.length - 62; i++) delete stats[keys[i]]
          }
          return { prayerDayStats: stats }
        }),

      // Called when a full prayer cycle completes; idempotent per day.
      markPrayedToday: () => {
        const d = new Date()
        const key = (t) =>
          `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
            t.getDate()
          ).padStart(2, '0')}`
        const today = key(d)
        const y = new Date(d)
        y.setDate(d.getDate() - 1)
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
          prayerDayStats: s.prayerDayStats,
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
        const pick = (a, b) => Math.max(a || 0, b || 0)
        const mergeDay = (local, incoming) => {
          const out = { ...local }
          for (const [d, map] of Object.entries(incoming || {})) {
            out[d] = { ...(out[d] || {}) }
            for (const [k, v] of Object.entries(map)) out[d][k] = pick(out[d][k], v)
          }
          return out
        }
        const prayerCompletions = { ...s.prayerCompletions }
        for (const [k, v] of Object.entries(stats.prayerCompletions || {})) {
          prayerCompletions[k] = pick(prayerCompletions[k], v)
        }
        let lastPrayedDay = s.lastPrayedDay
        if (stats.lastPrayedDay && (!lastPrayedDay || stats.lastPrayedDay > lastPrayedDay)) {
          lastPrayedDay = stats.lastPrayedDay
        }
        set({
          prayerCompletions,
          prayerDayCompletions: mergeDay(s.prayerDayCompletions, stats.prayerDayCompletions),
          prayerDayStats: mergeDay(s.prayerDayStats, stats.prayerDayStats),
          localPrayerSeconds: pick(s.localPrayerSeconds, stats.localPrayerSeconds),
          streak: pick(s.streak, stats.streak),
          bestStreak: pick(s.bestStreak, stats.bestStreak),
          lastPrayedDay
        })
      },

      // ---- derived ----
      getGlow: () => {
        const s = get()
        const total = Math.max(s.basePrayerSeconds, s.totalPrayerSeconds) + s.localPrayerSeconds
        return Math.min(1, total / TOTAL_TO_FULL)
      },
      getGlowPercent: () => Math.round(get().getGlow() * 100),
      getEarthBrightness: () => {
        const glow = get().getGlow()
        return 0.16 + glow * 0.84
      },

      // All-time count of a prayer ever carried: believable base + the shared
      // server's real count + this person's own completed cycles.
      getPrayerTotal: (prayerId) => {
        const s = get()
        return (
          (prayerBaseTotals[prayerId] || 0) +
          (s.prayerTotals[prayerId] || 0) +
          (s.prayerCompletions[prayerId] || 0)
        )
      },
      // How many times this prayer was recited today (per-repetition for mantras).
      getPrayerToday: (prayerId) => {
        const key = dayKey(new Date())
        return get().prayerDayCompletions[key]?.[prayerId] || 0
      },
      getSpiritTotal: (spiritId) => {
        const s = get()
        let local = 0
        const spirit = SPIRITUALITY_BY_ID[spiritId]
        if (spirit) {
          for (const p of spirit.prayers) local += s.prayerCompletions[p.id] || 0
        }
        return (spiritBaseTotals[spiritId] || 0) + (s.spiritTotals[spiritId] || 0) + local
      }
    }),
    {
      name: 'prayer-earth-v1',
      partialize: (s) => ({
        spiritId: s.spiritId,
        prayerId: s.prayerId,
        localPrayerSeconds: s.localPrayerSeconds,
        basePrayerSeconds: s.basePrayerSeconds,
        loopOn: s.loopOn,
        voiceURI: s.voiceURI,
        prayerVoices: s.prayerVoices,
        speechRate: s.speechRate,
        ambienceLevel: s.ambienceLevel,
        volume: s.volume,
        locale: s.locale,
        theme: s.theme,
        profile: s.profile,
        prayerCompletions: s.prayerCompletions,
        prayerDayCompletions: s.prayerDayCompletions,
        prayerDayStats: s.prayerDayStats,
        streak: s.streak,
        bestStreak: s.bestStreak,
        lastPrayedDay: s.lastPrayedDay,
        anonId: s.anonId
      })
    }
  )
)

export const TOTAL_TO_FULL_EXPORT = TOTAL_TO_FULL

// Dev-only handle so the test harness can probe live state.
if (import.meta.env?.DEV) {
  window.__store = useStore
}

