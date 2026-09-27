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

export const DEFAULT_AMBIENT_PRESET = 'reiki'
