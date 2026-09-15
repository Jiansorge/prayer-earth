import { useEffect, useRef } from 'react'

// Focus a modal sheet on open and trap Tab navigation inside it so keyboard
// and screen-reader users can't drop focus onto the page behind the dialog.
// Returns a ref to attach to the dialog element.
export default function useFocusTrap(active) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const node = ref.current
    const prev = document.activeElement
    const focusTimer = setTimeout(() => {
      if (node && !node.contains(document.activeElement)) node.focus()
    }, 40)

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const focusable = node.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown, true)
      if (prev && prev.focus && typeof prev.focus === 'function') prev.focus()
    }
  }, [active])

  return ref
}