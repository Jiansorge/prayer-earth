// Is our rendering independent of the published one, or did we paraphrase?
//
// A rights-clean replacement has to be an independent rendering, not a tidy-up
// of someone else's translation - a light paraphrase is still derivative. This
// compares our text against the published rendering phrase by phrase, ignoring
// case and punctuation, and reports the longest run of shared words.
//
// Some overlap is unavoidable and expected: the prostration formula ("To the
// Tathagata X I bow") is a fixed liturgical formula, identical in every
// translation and every language, and the Buddha names are shared terminology.
// What must NOT appear is long shared prose, because that would mean we took
// someone's sentences rather than the tradition's content.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(path.join(ROOT, 'src/data/spirits/buddhism.js'), 'utf8')

const block = src.slice(
  src.indexOf("id: 'thirtyfive-confession'"),
  src.indexOf("id: 'high-king-sutra'")
)
const ours = [...block.matchAll(/\{ t: ("(?:[^"\\]|\\.)*")/g)].map((m) => JSON.parse(m[1]))

// The published rendering, as supplied for this app. Held here only to be
// compared against; it is not shipped.
const PUBLISHED = [
  'I, whose name is . . . , at all times go for refuge to the Guru, go for refuge to the Buddha, go for refuge to the Dharma, go for refuge to the Sangha.',
  'To the Teacher, World Honored One, Tathagata, Foe Destroyer, Completely Perfect Buddha, Glorious Conqueror Shakyamuni I prostrate.',
  'All you [Tathagatas] and all the others, however many Tathagatas, the Foe Destroyers, the Completely Perfect Buddhas, the World Honored Ones there are dwelling and abiding in all the worldly realms of the ten directions, all you Buddhas, the World Honored Ones, please listen to me.',
  'In this life and in all my lives since beginning-less time, in all my places of rebirth while wandering in samsara, I have done negative actions, have ordered them to be done, and have rejoiced in their being done.',
  'I have stolen the property of the bases of offering, the property of the Sangha, and the property of the Sanghas of the ten directions, have ordered it to be stolen, and have rejoiced in it being stolen.',
  'I have committed the five unbounded heinous actions, have ordered them to be committed, and have rejoiced in their being committed.',
  'I have completely engaged in the paths of the ten non-virtuous actions, have ordered others to engage in them, and have rejoiced in their engaging in them.',
  'Being obstructed by such karmic obstructions, I shall become a hell being, or I shall be born as an animal, or I shall go to the land of the hungry ghosts, or I shall be born as a barbarian in an irreligious country, or I shall be born as a long-life god, or I shall come to have incomplete senses, or I shall come to hold wrong views, or I shall have no opportunity to please a Buddha.',
  'All such karmic obstructions I declare in the presence of the Buddhas, the World Honored Ones, who have become exalted wisdom, who have become eyes, who have become witnesses, who have become valid, who see with their wisdom. I confess without concealing or hiding anything, and from now on I will avoid and refrain from such actions.',
  'All you Buddhas, the World Honored Ones, please listen to me. In this life and in all my previous lives since the beginning-less time, in all my places of rebirth while wandering in samsara, whatever root of virtue there is in my giving to others, even in my giving a morsel of food to one born as an animal; whatever root of virtue there is in my maintaining moral discipline; whatever root of virtue there is in my actions conducive to great liberation; whatever root of virtue there is in my acting to fully ripen sentient beings; whatever root of virtue there is in my generating a supreme mind of enlightenment; and whatever root of virtue there is in my unsurpassed exalted wisdom; all of these assembled, gathered, and collected together, by fully dedicating them to the unsurpassed, to that of which there is no higher, to that which is even higher than the high, and to that which surpasses the unsurpassed, I fully dedicate to the unsurpassed, perfect, complete enlightenment.',
  'Just as the Buddhas, the World Honored Ones of the past, have dedicated fully, just as the Buddhas, the World Honored Ones who are yet to come, will dedicate fully, and just as the Buddhas, the World Honored Ones who are living now, dedicate fully, so too do I dedicate fully.',
  'I confess individually all negative actions. I rejoice in all merit. I beseech and request all the Buddhas. May I attain the holy, supreme, unsurpassed, exalted wisdom.',
  'Whoever are the Conquerors, the supreme beings living now, those of the past, and likewise those who are yet to come, with a boundless ocean of praise for all your good qualities, and with my palms pressed together I go close to you for refuge.'
]

const norm = (s) =>
  s.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)

const pubWords = new Map()
PUBLISHED.forEach((p, pi) => {
  norm(p).forEach((w, wi) => {
    if (!pubWords.has(w)) pubWords.set(w, [])
    pubWords.get(w).push(`${pi}:${wi}`)
  })
})

let worst = { run: 0, phrase: '', words: [] }
let oursTotal = 0
let oursShared = 0
for (const phrase of ours) {
  const w = norm(phrase)
  oursTotal += w.length
  let run = 0
  for (const word of w) {
    if (pubWords.has(word)) {
      run++
      oursShared++
    } else {
      if (run > worst.run) worst = { run, phrase, words: w.slice(0, run) }
      run = 0
    }
  }
  if (run > worst.run) worst = { run, phrase, words: w.slice(0, run) }
}

console.log(`our phrases: ${ours.length}`)
console.log(`word overlap with the published rendering: ${oursShared}/${oursTotal} (${((oursShared / oursTotal) * 100).toFixed(1)}%)`)
console.log(`longest shared word run: ${worst.run}`)
console.log(`  in: "${worst.phrase.slice(0, 90)}"`)
console.log(`  shared: ${worst.words.join(' ')}`)

// Two liturgical formulae run to about this length and are expected to match:
// the opening refuge (I take refuge in the teacher, the Buddha, the Dharma, the
// Sangha) and the prostration (To the Tathagata X I bow). Both are recited
// identically in every translation and in every language the text is used in -
// that is what makes them formulae rather than prose anyone composed.
//
// So the bar is: nothing longer than a formula. A run beyond it means the
// passage is prose, and prose matching means we leaned on someone's sentences
// instead of writing our own.
const LIMIT = 14
if (worst.run > LIMIT) {
  console.log('')
  console.log(`SHARED RUN OF ${worst.run} WORDS - longer than a fixed formula. This is not an independent rendering.`)
  process.exit(1)
}
console.log('')
console.log(`ok - longest shared run is ${worst.run} words, within the fixed liturgical formula`)
process.exit(0)