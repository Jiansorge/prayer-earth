import { useStore } from '../store.js'
import { speech } from './speech.js'
import { ambient } from './ambience.js'

// One place that pushes the stored volume into both engines.
//
// This existed implicitly in three places and they had drifted apart, which is
// how the prayer view ended up with a fader labelled "volume" that only moved the
// voice while the bed kept playing. A user turning a slider marked volume expects
// the room to get quieter.
//
// The earlier attempt at this deliberately decoupled them: routing the voice
// fader into the ambient engine meant dragging it to 0 silenced the bed, and the
// Settings ambience slider could not undo it because that only called setLevel.
// Decoupling fixed that but threw away the master control entirely.
//
// Routing both through one function keeps the good part - every slider that
// changes volume changes both engines - so raising either one raises the bed
// again, and there is no state that only one slider can escape.

// Push the current store volume to speech and to the ambient bed together.
// Mute stays a separate, absolute concern: it zeroes both regardless of volume,
// and unmuting restores the remembered level rather than snapping to full.
export function applyVolumes() {
  const s = useStore.getState()
  const level = s.muted ? 0 : s.volume
  speech.setVolume(level)
  // The bed takes the same level as the voice. It is still a true 0/1 when
  // muted, so a muted bed never comes back at a fraction of the volume slider.
  ambient.setVolume(level)
}