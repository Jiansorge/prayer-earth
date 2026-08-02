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
      playTick: 0,
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

      // who you are on the Earth: a sacred name, a nature avatar, a light
      profile: { name: '', avatar: '🌿', color: '#7fc9a0' },

      localPrayerSeconds: 0,
      loopOn: true,
      voiceURI: null,
      speechRate: 0.85,
      ambienceLevel: 0.7,
      volume: 0.5,
      locale: 'en',

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
      requestPlayToggle: () => set((s) => ({ playTick: (s.playTick || 0) + 1 })),
      setLoopOn: (loopOn) => set({ loopOn }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setSpeechRate: (speechRate) => set({ speechRate }),
      setAmbienceLevel: (ambienceLevel) => set({ ambienceLevel }),
      setVolume: (volume) => set({ volume }),
      setLocale: (locale) => set({ locale }),

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
        speechRate: s.speechRate,
        ambienceLevel: s.ambienceLevel,
        volume: s.volume,
        locale: s.locale,
        profile: s.profile,
        prayerCompletions: s.prayerCompletions,
        prayerDayCompletions: s.prayerDayCompletions,
        prayerDayStats: s.prayerDayStats,
        streak: s.streak,
        bestStreak: s.bestStreak,
        lastPrayedDay: s.lastPrayedDay
      })
    }
  )
)

export const TOTAL_TO_FULL_EXPORT = TOTAL_TO_FULL

// Dev-only handle so the test harness can probe live state.
if (import.meta.env?.DEV) {
  window.__store = useStore
}

