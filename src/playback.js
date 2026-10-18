import { useStore } from './store.js'
import { syncClient } from './sync/client.js'
import { ambient } from './audio/ambience.js'

// speech.js (~27 KB) is only needed once playback starts, so it is imported
// lazily on first use instead of being pulled into the entry bundle via Nav.
let _speechPromise = null
const getSpeech = () => {
  if (!_speechPromise) _speechPromise = import('./audio/speech.js').then((m) => m.speech)
  return _speechPromise
}

// Prime the audio graph inside the user gesture, but never let a hung
// AudioContext.resume() (blocked / headless / interrupted WebView) stall the
// play action — the prayer must start regardless. This races ensure() against a
// short timeout; the ambience graph resumes in the background if it can.
const primeAudio = () =>
  Promise.race([
    Promise.resolve(ambient.ensure()).catch(() => {}),
    new Promise((r) => setTimeout(r, 300))
  ])

// The footer play button works from anywhere. If nothing is playing it goes
// straight to the last prayer and starts it; otherwise it pauses/resumes.
export async function requestPlayToggle() {
  const s = useStore.getState()
  const speech = await getSpeech()

  if (s.playing && !s.paused) {
    // Playing right now, pause.
    speech.pause()
    useStore.setState({ paused: true, praying: false })
    syncClient.presenceNow()
    // Pause means silent. The prayer page's own toggle always dropped the bed
    // here; this path (footer play/pause, from any view) never touched it, so
    // the same pause stopped the ambient sound on one screen and left it
    // running on another - and leaving it up meant resuming had nothing to
    // bring back.
    ambient.setLevel(0)
    return
  }

  if (s.playing && s.paused) {
    // Paused, resume if the job is still alive, otherwise restart the prayer.
    if (!speech.resume()) {
      await primeAudio()
      const spiritId = s.spiritId || 'christianity'
      const prayerId = s.prayerId || 'lords-prayer'
      useStore.setState({
        view: 'prayer',
        spiritId,
        prayerId,
        paused: false,
        pendingPlay: true
      })
      return
    }
    useStore.setState({ paused: false, praying: true })
    syncClient.presenceNow()
    // Mirror the prayer page's resume level, so both paths agree on how loud
    // the bed comes back.
    ambient.setLevel(0.9)
    return
  }

  // Nothing playing, go to the last prayer and start it.
  await primeAudio()
  const spiritId = s.spiritId || 'christianity'
  const prayerId = s.prayerId || 'lords-prayer'
  useStore.setState({ view: 'prayer', spiritId, prayerId, pendingPlay: true })
}

// Stop playback from anywhere (footer stop button). The current prayer stops
// and the world stops counting it; the last prayer is remembered for later.
export async function stopPlayback() {
  const speech = await getSpeech()
  speech.stop()
  useStore.setState({
    playing: false,
    paused: false,
    praying: false,
    playingPrayerId: null,
    playingSpiritId: null,
    playingSessionId: null
  })
  syncClient.presenceNow()
  ambient.setLevel(0)
}
