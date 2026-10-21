import { useEffect } from 'react'

// Scroll memory for the settings sheet.
//
// Module-level on purpose: the sheet returns null when closed, so a ref inside
// the component is recreated from scratch on the next open and remembers
// nothing. Someone who scrolled to the delete button, closed the sheet to check
// something, and came back should land where they were, not at the top.
//
// Keyed by panel so that going into Privacy and pressing Back also returns you
// to where you were in the list behind it.
const scrollMemory = { main: 0, privacy: 0, backup: 0, data: 0, keys: 0 }

export default function useSheetScroll({ open, panel, bodyRef }) {
  // Restore this panel's scroll position on open, and bank it on the way out.
  //
  // This must sit ABOVE the `if (!open) return null` below. A hook after an
  // early return is a conditional hook, React throws on it, and the settings
  // sheet stops rendering entirely - which is exactly what happened the first
  // time this was written.
  //
  // The bodyRef is null while closed, so the effect no-ops then and does its real
  // work on the open. Keyed on `panel` so going into Privacy and pressing Back
  // restores the list's place rather than the sub-panel's.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return undefined
    const key = panel || 'main'
    const wanted = scrollMemory[key]

    // Bank the position as the user scrolls, not on the way out.
    //
    // Reading it in the cleanup does not work: the cleanup runs when `open`
    // flips to false, and by then React has already removed .sheet-body from
    // the DOM, so el.scrollTop is 0 no matter where the sheet had been left.
    // That was measured, not assumed - the banked value came back as 0 from a
    // sheet scrolled to 400.
    //
    // Guarded on `key` still being the visible panel. When a sub-panel opens,
    // the browser clamps the container's scrollTop (the new content is shorter)
    // and fires a scroll event during the scroll-steps phase - BEFORE passive
    // effects, and so before this listener is removed. Without the guard that
    // clamp wrote the old panel's key, and pressing Back restored the clamped
    // position instead of where the user had been.
    const onScroll = () => {
      if ((panel || 'main') !== key) return
      scrollMemory[key] = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })

    // Restore after layout, not during the commit: the sheet moves focus into
    // itself shortly after opening, and a focused element is scrolled into
    // view; lazy images are still growing the content, so the clamp is computed
    // against a shorter scrollHeight than the offset was taken from.
    //
    // The else branch matters. With no stored offset - opening a sub-panel for
    // the first time - the container is still sitting at the list's offset, and
    // a shorter sub-panel opened mid-scroll hides its own Back control above the
    // fold. Start at the top instead.
    let frame = 0
    frame = requestAnimationFrame(() => {
      if (bodyRef.current !== el) return
      el.scrollTop = wanted || 0
    })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [panel, open])
}
