import { useStore } from '../store.js'
import { speech } from './speech.js'
import { ambient } from './ambience.js'

// The room-wide mute lives in the store so the footer nav, the prayer controls
// and the keyboard all share one switch. Muting silences speech + ambient while
// remembering the previous level, so unmuting restores it exactly.

export function applyMute(muted) {
  const s = useStore.getState()
  const next = !!muted
  const target = next ? 0 : s.lastVolume
  if (next && !s.muted) {
    useStore.setState({ lastVolume: s.volume })
  }
  useStore.setState({ muted: next, volume: target })
  speech.setVolume(target)
  ambient.setVolume(target)
}

export function toggleMute() {
  applyMute(!useStore.getState().muted)
}
