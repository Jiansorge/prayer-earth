import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { prayerBaseTotals, spiritBaseTotals } from './data/totals.js'
import { SPIRITUALITY_BY_ID } from './data/prayers.js'
import { mergeStats } from './shared/stats.js'

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
      // how many people prayed today / this week (drives the Earth's glow)
      usersToday: 0,
      usersWeek: 0,
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
      setUsersActivity: (usersToday, usersWeek) => set({ usersToday, usersWeek }),
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
      // How alight the Earth is. Never fully dark; the permanent all-time base
      // grows slowly with cumulative prayer, while the day/week community and
      // the people praying right now lift it higher. 100% means a genuinely
      // alive world: a year of cumulative prayer plus ~150 praying today,
      // ~500 this week, and ~40 in this moment.
      getGlow: () => {
        const s = get()
        const total = Math.max(s.basePrayerSeconds, s.totalPrayerSeconds) + s.localPrayerSeconds
        const permanent = Math.min(1, Math.log10(1 + total) / 3.56)
        const today = Math.min(1, (s.usersToday || 0) / 150)
        const week = Math.min(1, (s.usersWeek || 0) / 500)
        const live = Math.min(1, (s.peoplePraying || 0) / 40)
        return Math.min(1, 0.12 + 0.3 * permanent + 0.3 * today + 0.18 * week + 0.1 * live)
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

// Dev-only handle so the test harness can probe live state.
if (import.meta.env?.DEV) {
  window.__store = useStore
}

