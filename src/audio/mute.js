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
  // Mute the bed as a TRUE mute (0 / 1). Passing `target` (the voice volume)
  // here re-coupled the ambient bed to the prayer-voice fader: every unmute
  // left the bed at the voice level instead of its own. The bed's loudness is
  // driven by the "Ambient sound volume" slider alone.
  ambient.setVolume(next ? 0 : 1)
}

export function toggleMute() {
  applyMute(!useStore.getState().muted)
}
