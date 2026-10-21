import { useEffect, useRef } from 'react'
import { useStore } from '../store.js'
import { ambient } from '../audio/ambience.js'

export default function useSheetBed({ open, panel, legalOpen }) {
  // Soften the bed while the sheet is open, then restore the prayer level on
  // close. Without the restore, opening Settings mid-prayer left the bed at the
  // idle 0.4 for the rest of the prayer (and the ambience slider, which
  // re-applies ambient.level, could no longer climb back up).
  //
  // Only ever LOWER. This used to write 0.4 unconditionally, so a bed that was
  // at 0 - prayer ended, paused, or never played - was raised to 0.4 and the
  // ambient sound started with nothing playing at all, the moment the sheet
  // opened. A silent bed stays silent; only a bed that was actually up gets
  // dipped and restored.
  const prevLevelRef = useRef(null)
  // Ambient in this sheet is a sandbox. Opening it never starts sound (the
  // effect below only ever lowers); tapping a bed chip DOES - picking a sound
  // is the one explicit request to hear it - but that sound belongs to the
  // sheet: closing the sheet, or stepping into a sub-panel (Privacy, backup,
  // data, keys, legal), ends it. A bed that was already running when the sheet
  // opened is the prayer's, and the dip/restore above owns it: killing it here
  // would silence the prayer behind the sheet, which is the opposite of the
  // restore's contract.
  const runningAtOpenRef = useRef(null)
  const bedPickedRef = useRef(false)
  // The audition's ctx creation is async: the sheet can close (or step into a
  // sub-panel) before ensure() resolves, and the start that lands after would
  // otherwise resurrect the bed endSheetBed just gave up on. The flag closes
  // that window - set before the reset, checked inside the pending start.
  const previewCancelRef = useRef(false)
  const endSheetBed = () => {
    const playingNow = useStore.getState().playing
    if (bedPickedRef.current && runningAtOpenRef.current === false && !playingNow) {
      ambient.stop()
      ambient.setLevel(0)
    }
    previewCancelRef.current = true
    bedPickedRef.current = false
  }
  // The sheet's own audition: chip tapped while nothing is playing starts the
  // bed from that gesture at the sheet's idle level - never on open, only on
  // the explicit pick - and is tracked as the sheet's to stop.
  const onBedPick = () => {
    bedPickedRef.current = true
    previewCancelRef.current = false
    ambient.ensure().then(() => {
      if (previewCancelRef.current || bedPickedRef.current === false) return
      ambient.start().catch(() => {})
      ambient.setLevel(0.4)
    }).catch(() => {})
  }
  useEffect(() => {
    if (open) {
      runningAtOpenRef.current = ambient.running
      bedPickedRef.current = false
      previewCancelRef.current = false
    }
  }, [open])
  // A step into a sub-panel is an exit for the same reason a close is: the
  // reader left the sound section, so the preview ends there too.
  useEffect(() => {
    if (open && (panel || legalOpen)) endSheetBed()
  }, [open, panel, legalOpen])
  useEffect(() => {
    if (!ambient.ctx) return
    if (open) {
      if (ambient.level > 0.4) {
        prevLevelRef.current = ambient.level
        ambient.setLevel(0.4)
      }
    } else {
      if (prevLevelRef.current != null) {
        ambient.setLevel(prevLevelRef.current)
        prevLevelRef.current = null
      }
      // Unconditional: a bed the sheet auditioned may have started with no
      // dip at all (no ctx existed when the sheet opened), so the restore's
      // branch alone would miss it.
      endSheetBed()
    }
  }, [open])

  return { onBedPick }
}
