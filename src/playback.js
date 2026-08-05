import { useStore } from './store.js'
import { speech } from './audio/speech.js'
import { syncClient } from './sync/client.js'
import { ambient } from './audio/ambience.js'

// The footer play button works from anywhere. If nothing is playing it goes
// straight to the last prayer and starts it; otherwise it pauses/resumes.
export function requestPlayToggle() {
  const s = useStore.getState()

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
