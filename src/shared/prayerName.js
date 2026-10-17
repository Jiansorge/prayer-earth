// The practitioner's blank: "I, whose name is . . . , take refuge..."
//
// Filled at render time from the profile name. It is never written into the
// prayer data - the source keeps the conventional ellipsis, so an audit reading
// the file still sees the text as it was edited - and it is never handed to the
// speech engine. Two decisions are encoded here.
//
// Consent. sharePresence is the switch that already decides whether the name
// appears anywhere another person can see, so prayer text reads that same
// switch rather than growing a second one that could disagree with it. Sharing
// off, no name, or a name sanitizeName rejects all leave the plain ellipsis,
// which is the conventional form anyway - the fallback reads as a complete
// prayer, not a broken one.
//
// Audio stays as recorded. The recording says the blank and the per-phrase
// highlight follows the recording, so the screen and the voice can differ on
// this one line, deliberately: filling the audio would mean a recording per
// person, or live speech cross-faded into a forty-eight phrase track, or
// dropping to synthesized speech for the whole prayer whenever a name is set.
import { sanitizeName } from './profanity.js'

// Dot, spaces, dot, spaces, dot - how the data writes the blank. Requiring the
// separators keeps a plain "..." or a dotted number from ever being rewritten,
// so only a deliberate blank is treated as one.
//
// Whitespace after the blank is swallowed only when punctuation follows it, so
// "whose name is . . . , take refuge" reads "whose name is Amara, take refuge"
// rather than "Amara , take" - while a blank sitting in the middle of a clause
// keeps the space that separates it from the next word.
const BLANK = /\.\s+\.\s+\.(?:\s+(?=[,.;:?!]))?/g

// The name to show, or '' to keep the ellipsis.
export function practitionerName(profileName, sharePresence) {
  if (!sharePresence) return ''
  return sanitizeName(profileName) || ''
}

// Fill every blank in a line of rendered prayer text. A replacer function, not
// a string, because a name may contain "$" and String.replace would otherwise
// read it as a substitution pattern.
export function fillPractitionerName(text, name) {
  if (!name || typeof text !== 'string') return text
  return text.replace(BLANK, () => name)
}
