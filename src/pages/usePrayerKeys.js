import { useEffect, useRef } from 'react'
import { useStore } from '../store.js'
import { toggleMute } from '../audio/mute.js'
import { isAppShell } from '../shared/mobile.js'

export default function usePrayerKeys({ tuning, setTuning, togglePlay, toggleLoop, stopJob, setLiveVolume }) {
  // Keyboard controls: Space play/pause, ↑/↓ volume, M mute, R repeat, S stop.
  // Handlers reference refs to avoid detaching/re-attaching on every volume
  // change or play-state toggle, which previously happened on every slider drag.
  // Ref assignments live inside the effect so they can reference functions
  // declared later in the component body (no TDZ in the minified bundle).
  const keysRef = useRef({})
  useEffect(() => {
    keysRef.current.togglePlay = togglePlay
    keysRef.current.toggleMute = toggleMute
    keysRef.current.toggleLoop = toggleLoop
    keysRef.current.stopJob = stopJob
    keysRef.current.setLiveVolume = setLiveVolume
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Escape closes the tune panel on EVERY platform (including Android),
      // before the web-only key binds below.
      if (e.key === 'Escape' && tuning) {
        e.preventDefault()
        setTuning(false)
        return
      }
      // Space/arrows/m/r/s are physical-keyboard binds — the Android shell has
      // no physical keyboard, so treat the whole handler as web-only.
      if (isAppShell()) return
      // Space must still activate focused buttons/links (share, favorite,
      // close, …) — only take it over when focus is on the page background.
      if (e.target && e.target.closest && e.target.closest('button, a, [role="button"]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        keysRef.current.togglePlay()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const s = useStore.getState()
        keysRef.current.setLiveVolume(Math.min(1, Math.round((s.volume + 0.08) * 100) / 100))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const s = useStore.getState()
        keysRef.current.setLiveVolume(Math.max(0, Math.round((s.volume - 0.08) * 100) / 100))
      } else if (e.key === 'm' || e.key === 'M') {
        keysRef.current.toggleMute()
      } else if (e.key === 'r' || e.key === 'R') {
        keysRef.current.toggleLoop()
      } else if (e.key === 's' || e.key === 'S') {
        keysRef.current.stopJob()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tuning])
}
