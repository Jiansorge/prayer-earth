// Shared list of selectable ambient beds. Kept in its own module so both the
// store (which validates the persisted value) and the audio engine (which
// builds it) can import it without a cycle.
export const AMBIENT_PRESETS = [
  'reiki',
  'ocean',
  'temple',
  'rain',
  'forest',
  'space',
  'warm'
]

// Temple Bowl: near-silence under rare, resonant strikes. It is the quietest of
// the seven and the one people reach for when the others feel like too much, so
// it is what a new user gets before they have found the slider.
export const DEFAULT_AMBIENT_PRESET = 'temple'
