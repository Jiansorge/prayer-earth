import { useEffect } from 'react'
import { useStore } from '../store.js'
import { speech } from '../audio/speech.js'
import { ambient } from '../audio/ambience.js'
import { syncClient } from '../sync/client.js'

const TAB_ID = (window.__PE_TAB = window.__PE_TAB || Math.random().toString(36).slice(2))

export function broadcastPlayStarted() {
  try {
    new BroadcastChannel('prayer-earth').postMessage({ type: 'play', from: TAB_ID })
  } catch {}
}

export default function usePrayerSync({ playing, pendingPlay, prayer, startJob }) {
  // One prayer at a time per browser: another tab starting playback pauses us.
  // BroadcastChannel also delivers to this same tab, so each message carries its
  // sender's tab id and we ignore our own.
  useEffect(() => {
    const ch = new BroadcastChannel('prayer-earth')
    ch.onmessage = (e) => {
      const m = e.data
      if (!m || m.type !== 'play' || m.from === TAB_ID) return
      const s = useStore.getState()
      // Another tab just started a prayer — one-at-a-time: pause us, and never
      // let our local "starting…" guard swallow it.
      if (s.playing && !s.paused) {
        speech.pause()
        s.setPaused(true)
        s.setPraying(false)
        syncClient.presenceNow()
        ambient.setLevel(0)
      }
    }
    return () => ch.close()
  }, [playing])

  // The footer play button from home/earth lands here ready to play. Runs both
  // when this page mounts AND when a play request arrives while already here
  // (e.g. after picking a prayer). Delayed a moment so React StrictMode's dev
  // remount (mount → unmount → mount) settles before starting.
  useEffect(() => {
    if (!pendingPlay || !prayer) return
    const t = setTimeout(() => {
      if (useStore.getState().pendingPlay) {
        useStore.getState().setPendingPlay(false)
        startJob()
      }
    }, 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlay, prayer])
}
