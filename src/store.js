import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { prayerBaseTotals, spiritBaseTotals } from './data/totals.js'
import { SPIRITUALITY_BY_ID } from './data/prayers.js'
import { mergeStats } from './shared/stats.js'

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
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {}
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {}
  }
}

const dayKey = (t) =>
  `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate()
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
      // which prayer is actually producing audio right now (so the footer and
      // other pages know what's playing even when viewing a different prayer)
      playingPrayerId: null,
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
      // when the shared world was first launched (ms epoch), so the glow can
      // show a gentle floor on day one and be fully honest afterwards
      startedAt: null,
      // this device's first run (ms epoch), the fallback birthday when the
      // engine doesn't report a server startedAt
      firstSeen: 0,
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
      muted: false,
      lastVolume: 0.5,
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
      // ids of prayers the person wants close to hand
      favorites: [],

      // daily streak
      streak: 0,
      bestStreak: 0,
      lastPrayedDay: null,
      celebrateStreak: 0,

      // a random, anonymous id so your lifetime stats can follow you between
      // devices, no account, no name, just an opaque token
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
      setPlayingPrayerId: (playingPrayerId) => set({ playingPrayerId }),
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
      setVolume: (volume) => set({ volume }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),

      // ---- sync ----
      setConnected: (connected) => set({ connected }),
      // A transient, non-blocking notice when the engine tells us why it closed
      // a connection (e.g. 'rate'). Null when all is well.
      setSyncNotice: (syncNotice) => set({ syncNotice }),
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
      setStartedAt: (startedAt) => set({ startedAt }),
      setFirstSeen: (firstSeen) => set({ firstSeen }),
      setTotalPrayerSeconds: (totalPrayerSeconds) =>
        set((s) => ({
          totalPrayerSeconds,
          basePrayerSeconds: Math.max(s.basePrayerSeconds, totalPrayerSeconds)
        })),
      addLocalPrayer: (seconds) =>
        set((s) => ({
          localPrayerSeconds: s.localPrayerSeconds + seconds
        })),

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
      // Cumulative all-time prayers (server totals + this person's own). Only
      // ever grows, so anything derived from it can only climb.
      getPrayerCount: () => {
        const s = get()
        return (
          Object.values(s.prayerTotals).reduce((a, b) => a + (b || 0), 0) +
          Object.values(s.prayerCompletions).reduce((a, b) => a + (b || 0), 0)
        )
      },
      // How alight the Earth is, shown as a percentage of a million prayers
      // prayed together. It is driven ONLY by cumulative all-time prayers
      // (server totals + this person's completions), which never decrease, so
      // the number and the Earth's glow can only ever climb. The curve is
      // gentle: it reads small at first and rises slowly, reaching 100% at the
      // million-prayer mark.
      getGlow: () => {
        const s = get()
        const prayers = s.getPrayerCount()
        return Math.min(1, Math.pow(prayers / 1_000_000, 0.4))
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
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        spiritId: s.spiritId,
        prayerId: s.prayerId,
        localPrayerSeconds: s.localPrayerSeconds,
        basePrayerSeconds: s.basePrayerSeconds,
        loopOn: s.loopOn,
        voiceURI: s.voiceURI,
        prayerVoices: s.prayerVoices,
        favorites: s.favorites,
        speechRate: s.speechRate,
        ambienceLevel: s.ambienceLevel,
        volume: s.volume,
        muted: s.muted,
        lastVolume: s.lastVolume,
        locale: s.locale,
        theme: s.theme,
        profile: s.profile,
        prayerCompletions: s.prayerCompletions,
        prayerDayCompletions: s.prayerDayCompletions,
        prayerDayStats: s.prayerDayStats,
        streak: s.streak,
        bestStreak: s.bestStreak,
        lastPrayedDay: s.lastPrayedDay,
        anonId: s.anonId,
        firstSeen: s.firstSeen
      })
    }
  )
)

// Dev-only handle so the test harness can probe live state.
if (import.meta.env?.DEV) {
  window.__store = useStore
}

// The prayer clock lives here (not on the prayer page) so a prayer keeps being
// counted toward the world totals even while you browse Home or the Earth with
// it playing in the background. No-ops whenever nothing is playing.
setInterval(() => {
  const s = useStore.getState()
  if (!s.playing || s.paused) return
  s.addLocalPrayer(1)
  s.addPrayerSecond(s.playingPrayerId)
  s.setElapsed(s.elapsed + 1)
}, 1000)

