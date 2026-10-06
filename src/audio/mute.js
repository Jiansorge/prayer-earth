import { useStore } from '../store.js'
import { applyVolumes } from './volumes.js'

// The room-wide mute lives in the store so the footer nav, the prayer controls
// and the keyboard all share one switch. Muting silences speech + ambient while
// remembering the previous level, so unmuting restores it exactly.
//
// The actual push into both engines is delegated to applyVolumes(), which every
// volume control uses. Keeping one function means mute and the sliders cannot
// disagree about what "volume" means.
export function applyMute(muted) {
  const s = useStore.getState()
  const next = !!muted
  const target = next ? 0 : s.lastVolume
  if (next && !s.muted) {
    useStore.setState({ lastVolume: s.volume })
  }
  useStore.setState({ muted: next, volume: target })
  applyVolumes()
}

export function toggleMute() {
  applyMute(!useStore.getState().muted)
}
