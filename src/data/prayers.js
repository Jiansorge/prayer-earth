// Spirituality metadata (id, name, emoji, glow, lightColor, tagline, prayerCount).
// Prayer texts live in src/data/spirits/<id>.js — loaded lazily on demand
// via loadSpirit(id) when a tradition is opened from the picker or home tiles.

export const SPIRITUALITIES = [
  { id: 'christianity', name: 'Christianity', emoji: '✝️', glow: 'rgba(201, 160, 60, 0.28)', lightColor: '#e8c47a', tagline: 'Grace, love, and the still small voice.', prayerCount: 16 },
  { id: 'islam', name: 'Islam', emoji: '☪️', glow: 'rgba(80, 200, 160, 0.28)', lightColor: '#5fd4a0', tagline: 'Surrender, peace, and the Mercy of God.', prayerCount: 19 },
  { id: 'hinduism', name: 'Hinduism', emoji: '🕉️', glow: 'rgba(255, 170, 110, 0.28)', lightColor: '#ff9e4f', tagline: 'Unity of all, the divine light within.', prayerCount: 18 },
  { id: 'buddhism', name: 'Buddhism', emoji: '☸️', glow: 'rgba(255, 210, 120, 0.26)', lightColor: '#ffd166', tagline: 'Compassion, stillness, and the middle way.', prayerCount: 26 },
  { id: 'nonreligious', name: 'Agnostic \u00B7 Atheist', emoji: '🌌', glow: 'rgba(150, 170, 255, 0.24)', lightColor: '#a9b0ff', tagline: 'Wonder, kindness, and the cosmos we share.', prayerCount: 22 },
  { id: 'chinese', name: 'Chinese Spirituality', emoji: '🐉', glow: 'rgba(255, 140, 95, 0.26)', lightColor: '#ff8a5c', tagline: 'Heaven, ancestors, and the spirits of home and land.', prayerCount: 7 },
  { id: 'sikhism', name: 'Sikhism', emoji: '💠', glow: 'rgba(120, 220, 220, 0.26)', lightColor: '#59d8d8', tagline: 'One Creator, truthful living, service to all.', prayerCount: 18 },
  { id: 'judaism', name: 'Judaism', emoji: '✡️', glow: 'rgba(120, 150, 255, 0.28)', lightColor: '#7aa2ff', tagline: 'Covenant, memory, and the Oneness of God.', prayerCount: 19 },
  { id: 'taoism', name: 'Taoism', emoji: '☯️', glow: 'rgba(200, 180, 255, 0.24)', lightColor: '#b09dff', tagline: 'Harmony, wu wei, and the flow of the Dao.', prayerCount: 16 },
  { id: 'confucianism', name: 'Confucianism', emoji: '🏮', glow: 'rgba(224, 90, 90, 0.26)', lightColor: '#e05a5a', tagline: 'Ren, ritual, and the harmony of all under heaven.', prayerCount: 15 },
  { id: 'shinto', name: 'Shinto', emoji: '⛩️', glow: 'rgba(255, 150, 120, 0.24)', lightColor: '#ff8f7a', tagline: 'Kami, purity, and gratitude before nature.', prayerCount: 6 },
  { id: 'jainism', name: 'Jainism', emoji: '🪷', glow: 'rgba(255, 210, 200, 0.24)', lightColor: '#ff9fbf', tagline: 'Ahimsa, reverence for all life, and inner freedom.', prayerCount: 6 },
  { id: 'african', name: 'African Traditions', emoji: '🐘', glow: 'rgba(224, 164, 88, 0.26)', lightColor: '#e0a458', tagline: 'Ancestors, the Great Spirit, and the living land.', prayerCount: 10 },
  { id: 'earthway', name: 'Earthway \u00B7 Indigenous', emoji: '🌿', glow: 'rgba(120, 200, 140, 0.24)', lightColor: '#7fd488', tagline: 'All my relations, gratitude to the living world.', prayerCount: 24 },
  { id: 'zoroastrianism', name: 'Zoroastrianism', emoji: '🕯️', glow: 'rgba(255, 190, 90, 0.26)', lightColor: '#ffc46b', tagline: 'Good thoughts, good words, good deeds, the flame of truth.', prayerCount: 5 },
]

export const SPIRITUALITY_BY_ID = Object.fromEntries(
  SPIRITUALITIES.map((s) => [s.id, s])
)

// Loads full spirit data (including .prayers) on demand. Patches the
// loaded data into SPIRITUALITY_BY_ID and SPIRITUALITIES in-place so all
// existing references stay valid after the first load.
//
// Each spirit is explicitly imported so Vite can statically split them
// into separate chunks — the variable-interpolated import('./spirits/'+id)
// can't be tree-shaken.
const _spiritLoaders = {
  christianity: () => import('./spirits/christianity.js'),
  islam: () => import('./spirits/islam.js'),
  hinduism: () => import('./spirits/hinduism.js'),
  buddhism: () => import('./spirits/buddhism.js'),
  nonreligious: () => import('./spirits/nonreligious.js'),
  chinese: () => import('./spirits/chinese.js'),
  sikhism: () => import('./spirits/sikhism.js'),
  judaism: () => import('./spirits/judaism.js'),
  taoism: () => import('./spirits/taoism.js'),
  confucianism: () => import('./spirits/confucianism.js'),
  shinto: () => import('./spirits/shinto.js'),
  jainism: () => import('./spirits/jainism.js'),
  african: () => import('./spirits/african.js'),
  earthway: () => import('./spirits/earthway.js'),
  zoroastrianism: () => import('./spirits/zoroastrianism.js'),
}
const _loaded = new Set()
export async function loadSpirit(id) {
  if (_loaded.has(id)) return SPIRITUALITY_BY_ID[id]
  const loader = _spiritLoaders[id]
  if (!loader) return SPIRITUALITY_BY_ID[id]
  _loaded.add(id)
  try {
    const mod = await loader()
    const spirit = mod.default || mod
    const full = { ...SPIRITUALITY_BY_ID[id], ...spirit }
    SPIRITUALITY_BY_ID[id] = full
    const idx = SPIRITUALITIES.findIndex((s) => s.id === id)
    if (idx !== -1) SPIRITUALITIES[idx] = full
    return full
  } catch (e) {
    _loaded.delete(id)
    console.error('loadSpirit failed:', id, e)
    return SPIRITUALITY_BY_ID[id]
  }
}

export function isLoaded(id) {
  return _loaded.has(id)
}

// Lazy prayerId -> prayer object lookup for WorldFeed.
export function getPrayerById(prayerId) {
  for (const s of SPIRITUALITIES) {
    if (!s.prayers) continue
    const p = s.prayers.find((p) => p.id === prayerId)
    if (p) return p
  }
  return null
}
