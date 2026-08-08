// Display-name moderation: the name a person chooses is shown to others while
// they pray (exactly like a username), so it must not be vulgar or profane.
// A blocked name is rejected and the caller falls back to a gentle random one.

const BLOCKED = new Set([
  'fuck', 'fuk', 'fck', 'fukk', 'shit', 'sht', 'bitch', 'btch', 'ass', 'asshole',
  'dick', 'cunt', 'kunt', 'pussy', 'cock', 'slut', 'whore', 'bastard', 'nigger',
  'nigga', 'faggot', 'fag', 'dyke', 'retard', 'rape', 'kys', 'nazi', 'hitler',
  'anus', 'ballsack', 'tits', 'boobs', 'penis', 'vagina', 'twat', 'wanker',
  'piss', 'cum', 'semen', 'gook', 'chink', 'spic', 'wetback', 'kike', 'tranny'
])

const normalize = (w) =>
  w
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/6/g, 'g')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z]/g, '')

// Returns the name trimmed to 24 chars, or '' if it is profane.
export function sanitizeName(raw) {
  const name = String(raw || '').trim().slice(0, 24)
  if (!name) return ''
  const words = name.split(/\s+/)
  for (const w of words) {
    if (w.length >= 2) {
      const n = normalize(w)
      if (n.length >= 3 && BLOCKED.has(n)) return ''
    }
  }
  return name
}
