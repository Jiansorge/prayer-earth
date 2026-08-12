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
    return
  }

  if (s.playing && s.paused) {
    // Paused, resume if the job is still alive, otherwise restart the prayer.
    if (!speech.resume()) {
      ambient.ensure() // prime audio inside the user gesture
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
    return
  }

  // Nothing playing, go to the last prayer and start it.
  ambient.ensure() // prime audio inside the user gesture
  const spiritId = s.spiritId || 'christianity'
  const prayerId = s.prayerId || 'lords-prayer'
  useStore.setState({ view: 'prayer', spiritId, prayerId, pendingPlay: true })
}

// Stop playback from anywhere (footer stop button). The current prayer stops
// and the world stops counting it; the last prayer is remembered for later.
export async function stopPlayback() {
  const speech = await getSpeech()
  speech.stop()
  useStore.setState({ playing: false, paused: false, praying: false, playingPrayerId: null })
  syncClient.presenceNow()
  ambient.setLevel(0.35)
}
