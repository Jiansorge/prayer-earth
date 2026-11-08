import { useStore } from '../store.js'
import { speech } from './speech.js'
import { ambient } from './ambience.js'

// One place that pushes the stored sound state into both engines.
//
// Two independent levels and one absolute switch:
//
//   volume          "Prayer voice volume" - the recitation only
//   ambienceLevel   "Ambient sound volume" - the bed only
//   muted           the room-wide switch, which silences BOTH
//
// They were briefly coupled: the voice fader also scaled the bed, to fix a
// fader labelled "volume" that only moved half the room. That fixed the label
// and broke the setting - ambient at 100% with the prayer voice at 0 went
// completely silent, because the bed was multiplied by the voice level - and it
// could not be undone from the ambience slider, which only re-ran setLevel with
// the same zero factor. A voice slider that mutes the room is the worse of the
// two bugs.
//
// What that fader actually is now says what it does: it is the prayer voice's
// level (and its aria-label is "Prayer voice volume", the same string the
// Settings slider uses). Ambient keeps its own slider, and mute stays the one
// control that silences everything.
export function applyVolumes() {
  const s = useStore.getState()
  // The voice follows its own slider; 0 is a silent recitation, not a silent
  // room.
  speech.setVolume(s.muted ? 0 : s.volume)
  // The bed is driven by ambienceLevel inside the engine, so this is only the
  // mute gate: a plain 0/1. Passing the voice level here is what used to mute
  // the bed with the voice.
  ambient.setVolume(s.muted ? 0 : 1)
}
