import { useEffect } from 'react'

// Warm the prayer-view bundle (three.js + the earth backdrop + PrayerPage),
// every home theme, the tradition picker, and the keyboard sheet on the
// first interaction, so opening a prayer, switching theme, tapping a
// tradition, or hitting ? doesn't stall on a lazy chunk download. The picker
// is the first thing anyone taps from home, and without it in here the
// first tradition paid for the picker chunk inline - the loading line
// nobody should have to meet on a local file. The keyboard sheet is web-only
// and was loaded inside the ? keypress itself, which is the shortcut lag.
export default function useWarmApp() {
useEffect(() => {
  const warm = () => {
    import('../components/EarthBackdrop.jsx').catch(() => {})
    import('../pages/PrayerPage.jsx').catch(() => {})
    import('../components/PrayerPicker.jsx').catch(() => {})
    import('../components/KeyboardHelp.jsx').catch(() => {})
    import('../components/MysticBackdrop.jsx').catch(() => {})
    import('../components/NatureBackdrop.jsx').catch(() => {})
    import('../components/SpaceBackdrop.jsx').catch(() => {})
    import('../components/TempleBackdrop.jsx').catch(() => {})
    import('../components/OceanBackdrop.jsx').catch(() => {})
    import('../components/DawnBackdrop.jsx').catch(() => {})
  }
  window.addEventListener('pointerdown', warm, { once: true, passive: true })
  return () => window.removeEventListener('pointerdown', warm)
}, [])
}
