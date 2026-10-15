// Does the prayer still reach the room when the platform's voice doesn't work?
//
// audit-audio-fallback.mjs is a source scan: it reads the fallback chain and
// reports what it finds. It cannot tell you whether the chain still runs. Every
// branch past that point is timing-dependent - an utterance that ends "too
// quickly", an engine that errors three times, a watchdog that only fires after
// the phrase has sat past its estimate - so the branches most likely to be
// broken are the ones no static read can exercise.
//
// This drives the real SpeechEngine in a real browser against a synthetic
// speechSynthesis that misbehaves on demand, and asserts the one property that
// matters: however the platform fails, the prayer still advances through every
// phrase, still sounds something, and still finishes. A silent hang is the
// failure mode; everything else is detail.
//
// Usage: node scripts/test-audio-fallback-runtime.mjs
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { killTree, coldSafePage, COLD_READY_TIMEOUT } from './lib/devserver.mjs'
import { resolveChrome, launchOptions } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = process.env.APP_URL || 'http://localhost:5173'

let pass = 0
let fail = 0
const notes = []
const t = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}
const eq = (actual, expected, msg) => assert.equal(actual, expected, msg)

// A prayer with pre-rendered phrases, and an id the catalogue has no
// recording for. The recorded id is a real shipped one - it only ever gains
// audio, so it stays recorded. The unrecorded one is deliberately absent
// rather than a real prayer: pointing at one worked only until that prayer was
// rendered, at which point the player served its mp3, never reached the
// engine, and every scenario here went silent. What these tests exercise is
// the fallback path, so the fixture has to be sure of never having audio.
const RECORDED = 'lords-prayer'
const UNRECORDED = 'fixture-no-recording'

// Two short phrases keep each scenario to seconds instead of minutes; the
// fallback decision happens on the first phrase either way.
const PHRASES = [
  { t: 'Om namo bhagavate', s: 'Om namo bhagavate' },
  { t: 'Amitabha', s: 'Amitabha' }
]

// A speechSynthesis whose every observable behaviour is a switch. `silent` is
// the important one: it reports nothing at all, which is what a WebView does
// after the machine sleeps.
const FAKE_SYNTH = `
(() => {
  const cfg = {
    voices: [],
    behaviour: 'normal',
    spoken: 0,
    cancelled: 0,
    // What each utterance actually carried. The fallback decision is not the
    // only thing worth proving - a prayer can reach a voice and still have it
    // read the wrong field, which is how a Chinese prayer ends up with its
    // pinyin read aloud in an English accent.
    texts: []
  }
  window.__tts = cfg
  class FakeUtterance {
    constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.volume = 1; this.pitch = 1; this.voice = null }
  }
  window.SpeechSynthesisUtterance = FakeUtterance
  // speechSynthesis is a readonly accessor on Window, so plain assignment is
  // silently dropped and the real engine survives - which looks like a test that
  // passed for the wrong reason. defineProperty actually installs the double.
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    get: () => synth
  })
  const synth = {
    speaking: false,
    paused: false,
    getVoices: () => cfg.voices,
    speak(u) {
      cfg.spoken++
      cfg.texts.push({ text: u.text, lang: u.lang, voice: u.voice ? u.voice.voiceURI : null })
      switch (cfg.behaviour) {
        case 'silent':
          return                      // never starts, never ends, never errors
        case 'error':
          if (u.onerror) u.onerror(new Event('error'))
          return
        case 'instant':
          // Reports a full utterance in well under 400ms - a voice list with no
          // usable voice behind it does exactly this.
          if (u.onstart) u.onstart()
          if (u.onend) u.onend()
          return
        default: {
          const delay = 1400
          setTimeout(() => {
            if (u.onstart) u.onstart()
            setTimeout(() => { if (u.onend) u.onend() }, delay)
          }, 20)
        }
      }
    },
    cancel() { cfg.cancelled++ },
    pause() {},
    resume() {},
    addEventListener() {},
    removeEventListener() {}
  }
})()
`

// The engine reads window.speechSynthesis once, in its constructor, so a page
// without it has to be a page that never had it.
const NO_SYNTH = `
Object.defineProperty(window, 'speechSynthesis', { get: () => undefined, configurable: true })
Object.defineProperty(window, 'SpeechSynthesisUtterance', { get: () => undefined, configurable: true })
`

// Runs one prayer through the engine and reports what happened. Everything the
// assertions read comes back from the page, so a failure reports the engine's
// actual behaviour instead of our expectation of it.
const RUNNER = `
window.__run = async (opts) => {
  const speech = window.__speech
  const amb = (await import('/src/audio/ambience.js')).ambient
  const { useStore } = await import('/src/store.js')
  // Absent on the no-engine page, where there is no synth to configure and the
  // spoken counters simply stay at zero.
  const cfg = window.__tts || { voices: [], behaviour: 'normal', spoken: 0, cancelled: 0, texts: [] }

  // Count the audible chant. Patching the module the engine already imported is
  // the difference between proving the room hears something and proving a flag
  // was set.
  window.__hum = 0
  if (!amb.__patched) {
    const hum = amb.hum.bind(amb)
    amb.hum = (...a) => { window.__hum++; return hum(...a) }
    amb.__patched = true
  }

  // hasStaticFor() guesses "maybe recorded" until the manifest arrives, so load
  // it first - otherwise every scenario would take the recorded branch.
  await speech.loadAudioManifest()
  cfg.voices = opts.voices || []
  cfg.behaviour = opts.behaviour || 'normal'
  cfg.spoken = 0
  cfg.cancelled = 0
  cfg.texts = []
  // The engine caches its voice list and only re-reads it on voiceschanged.
  // Without this the previous scenario's empty list (and the voiceDead flag it
  // set) decide the next one.
  speech.refreshVoices()
  useStore.setState({ voiceURI: opts.voiceURI || '', speechRate: 1 })

  // Synthetic phrases, with lang and speakLang taken straight from the
  // scenario. Both have to survive all the way to the utterance, which is the
  // thing the real app gets wrong when a prayer is configured to speak a
  // language the device cannot.
  const phrases = opts.phrases
  const lang = opts.lang || 'sa'
  const speakLang = opts.speakLang || null
  const prayerId = opts.prayerId

  const record = {
    reason: null,
    phrases: [],
    texts: [],
    finished: false,
    hum: 0,
    spoken: 0,
    audioRequests: 0,
    finalReason: null,
    speakLang
  }

  await speech.start({
    prayerId,
    lang,
    speakLang,
    phrases,
    rate: 1,
    loop: false,
    gapMs: 200,
    onPhrase: (i) => record.phrases.push(i),
    onFallback: (why) => { if (!record.reason) record.reason = why },
    onEnd: () => { record.finished = true }
  })

  const deadline = Date.now() + (opts.timeout || 25000)
  while (!record.finished && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100))
    record.hum = window.__hum
    record.spoken = cfg.spoken
    record.texts = cfg.texts.slice()
    record.audioRequests = performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/audio/')).length
    const j = speech.job
    record.finalReason = j ? j.chantReason || null : record.finalReason
  }

  record.hum = window.__hum
  record.spoken = cfg.spoken
  record.texts = cfg.texts.slice()
  record.audioRequests = performance
    .getEntriesByType('resource')
    .filter((e) => e.name.includes('/audio/')).length
  speech.stop()
  return record
}
`

async function withBrowser(fn) {
  const { chromium } = await import('playwright')
  // No autoplay policy: the point of this suite is to find out whether the
  // prayer actually makes sound, and a blocked play() would look like a
  // fallback bug that is really just the test environment.
  const browser = await chromium.launch(
    launchOptions(resolveChrome(), ['--autoplay-policy=no-user-gesture-required'])
  )
  try {
    return await fn(browser)
  } finally {
    await browser.close()
  }
}

const startServer = async () => {
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', '5174'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  })
  const app = 'http://localhost:5174'
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(app)
      if (r.ok) return { proc, app }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  killTree(proc)
  throw new Error('dev server did not start')
}

const VOICE = { voiceURI: 'fake', lang: 'en-GB', name: 'Fake', default: false, localService: true }

const { proc, app } = await startServer()
try {
  // ---- a device with no speech engine at all --------------------------------
  await withBrowser(async (browser) => {
    const page = await coldSafePage(browser)
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e.message)))
    await page.addInitScript(NO_SYNTH)
    await page.goto(app, { waitUntil: 'load' })
    await page.waitForFunction(() => !!window.__speech, null, { timeout: COLD_READY_TIMEOUT })
    await page.evaluate(RUNNER)

    const noEngine = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: RECORDED, phrases: PHRASES }
    )
    notes.push(
      `no engine + recorded:     reason=${noEngine.reason} phrases=${noEngine.phrases.length} finished=${noEngine.finished} audioReq=${noEngine.audioRequests}`
    )
    t('a device with no TTS still plays the recorded prayer', () => {
      eq(noEngine.reason, null, 'a recorded prayer must not fall back to chant')
      eq(noEngine.finished, true, 'the prayer never finished - it hung')
      eq(noEngine.phrases.length, PHRASES.length, 'not every phrase was spoken')
    })

    const noEngineNoAudio = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: UNRECORDED, phrases: PHRASES }
    )
    notes.push(
      `no engine + unrecorded:   reason=${noEngineNoAudio.reason} phrases=${noEngineNoAudio.phrases.length} hum=${noEngineNoAudio.hum} finished=${noEngineNoAudio.finished}`
    )
    t('a device with no TTS and no recording still chants audibly', () => {
      eq(noEngineNoAudio.reason, 'no-voices', 'wrong fallback reason')
      assert(
        noEngineNoAudio.hum > 0,
        'the chant fallback was chosen but ambient.hum never ran - the room is silent'
      )
      eq(noEngineNoAudio.finished, true, 'the prayer never finished - it hung')
      eq(noEngineNoAudio.phrases.length, PHRASES.length, 'not every phrase was shown')
    })

    t('no engine raised no uncaught errors', () => {
      eq(errors.length, 0, `uncaught: ${errors.join(' | ')}`)
    })
  })

  // ---- a device that has an engine, which is the interesting part ------------
  await withBrowser(async (browser) => {
    const page = await coldSafePage(browser)
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e.message)))
    await page.addInitScript(FAKE_SYNTH)
    await page.goto(app, { waitUntil: 'load' })
    await page.waitForFunction(() => !!window.__speech, null, { timeout: COLD_READY_TIMEOUT })
    await page.evaluate(RUNNER)

    const chosen = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: RECORDED, phrases: PHRASES, voiceURI: '__chant__' }
    )
    notes.push(`chant chosen:            reason=${chosen.reason} hum=${chosen.hum} finished=${chosen.finished}`)
    t('"Soft chant" plays the chant even when a voice is available', () => {
      eq(chosen.reason, 'chosen', 'the chosen chant was not honoured')
      assert(chosen.hum > 0, 'ambient.hum never ran')
      eq(chosen.finished, true, 'the prayer never finished')
    })

    const blankVoicesRecorded = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: RECORDED, phrases: PHRASES, voices: [] }
    )
    notes.push(
      `no voices + recorded:     reason=${blankVoicesRecorded.reason} audioReq=${blankVoicesRecorded.audioRequests} finished=${blankVoicesRecorded.finished}`
    )
    t('an empty voice list falls back to the recording, not the chant', () => {
      eq(blankVoicesRecorded.reason, null, 'chose the chant over a prayer that has audio')
      assert(
        blankVoicesRecorded.audioRequests > 0,
        'no recorded audio was ever requested'
      )
      eq(blankVoicesRecorded.finished, true, 'the prayer never finished')
    })

    const blankVoices = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: UNRECORDED, phrases: PHRASES, voices: [] }
    )
    notes.push(
      `no voices + unrecorded:   reason=${blankVoices.reason} hum=${blankVoices.hum} finished=${blankVoices.finished}`
    )
    t('Firefox-style blank voice list still reaches the room', () => {
      eq(blankVoices.reason, 'no-voices', 'wrong fallback reason')
      assert(blankVoices.hum > 0, 'ambient.hum never ran - the room is silent')
      eq(blankVoices.finished, true, 'the prayer never finished - it hung')
    })

    const instant = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: UNRECORDED, phrases: PHRASES, voices: [VOICE], behaviour: 'instant' }
    )
    notes.push(
      `instant utterance:       reason=${instant.reason} hum=${instant.hum} finished=${instant.finished}`
    )
    t('an utterance that ends instantly is not mistaken for a spoken prayer', () => {
      eq(instant.reason, 'instant', 'a voice that says nothing was accepted as speech')
      assert(instant.hum > 0, 'ambient.hum never ran - the room is silent')
      eq(instant.finished, true, 'the prayer never finished')
    })

    const errored = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: UNRECORDED, phrases: PHRASES, voices: [VOICE], behaviour: 'error' }
    )
    notes.push(
      `erroring engine:         reason=${errored.reason} spoken=${errored.spoken} hum=${errored.hum} finished=${errored.finished}`
    )
    t('an engine that errors on every phrase hands off to the chant', () => {
      eq(errored.reason, 'errors', 'wrong fallback reason')
      // Two phrases can only produce two failures, so this also proves the short
      // prayer does not simply finish in silence.
      assert(errored.spoken >= 2, `expected every phrase to be attempted, saw ${errored.spoken}`)
      assert(errored.hum > 0, 'ambient.hum never ran - the room is silent')
      eq(errored.finished, true, 'the prayer never finished - it hung')
    })

    const stalled = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: UNRECORDED, phrases: PHRASES, voices: [VOICE], behaviour: 'silent', timeout: 30000 }
    )
    notes.push(
      `silent engine:            reason=${stalled.reason} hum=${stalled.hum} phrases=${stalled.phrases.length} finished=${stalled.finished}`
    )
    t('an engine that goes silent mid-prayer is caught by the watchdog', () => {
      eq(stalled.reason, 'stall', 'wrong fallback reason')
      assert(stalled.hum > 0, 'ambient.hum never ran - the room is silent')
      eq(stalled.finished, true, 'the prayer never finished - it hung')
    })

    const normal = await page.evaluate(
      (o) => window.__run(o),
      { prayerId: UNRECORDED, phrases: PHRASES, voices: [VOICE], behaviour: 'normal', timeout: 30000 }
    )
    notes.push(
      `healthy engine:           reason=${normal.reason} spoken=${normal.spoken} hum=${normal.hum} finished=${normal.finished}`
    )
    t('a healthy engine speaks the prayer without reaching for the fallback', () => {
      eq(normal.reason, null, 'a working voice was needlessly abandoned')
      assert(normal.spoken >= PHRASES.length, `expected ${PHRASES.length} utterances, saw ${normal.spoken}`)
      eq(normal.hum, 0, 'the chant ran even though the voice worked')
      eq(normal.finished, true, 'the prayer never finished')
    })

    // ---- speakLang: a prayer whose own script has no voice -----------------
    // A prayer can be configured to speak its English rendering when the
    // device has no voice for its own language - high-king-sutra ships that
    // way (lang 'zh', speakLang 'en'). It is the configuration that can reach
    // a real device and say nothing useful, and it shipped with no coverage:
    // the scenarios above drove synthetic phrases at lang 'sa' with no
    // speakLang, so this branch - and the page's job of passing speakLang
    // through to the engine in the first place - was never exercised. That is
    // how a prayer configured to speak English ended up reported silent.
    //
    // The fixture is synthetic on purpose. It used to borrow high-king-sutra,
    // which held only while that prayer was unrecorded; once it was rendered
    // the player served the mp3 and never consulted the engine, so every
    // scenario here went quiet. What is under test is the branch, not the
    // shipped entry, so the fixture says what it means directly.
    const ZH_EN = {
      id: 'fixture-speaklang',
      lang: 'zh',
      speakLang: 'en',
      phrases: [
        { t: '南無佛', e: 'Homage to the Buddha' },
        { t: '南無法', e: 'Homage to the Dharma' }
      ]
    }

    const withEnglish = await page.evaluate(
      (o) => window.__run(o),
      {
        prayerId: ZH_EN.id,
        phrases: ZH_EN.phrases,
        lang: ZH_EN.lang,
        speakLang: ZH_EN.speakLang,
        voices: [VOICE],
        behaviour: 'normal',
        timeout: 30000
      }
    )
    notes.push(
      `speakLang + en voice:  texts=${withEnglish.texts.map((x) => JSON.stringify(x.text)).join(', ')} lang=${withEnglish.texts.map((x) => x.lang).join(',')}`
    )
    t('a speakLang=en prayer speaks its English rendering when an English voice exists', () => {
      eq(withEnglish.reason, null, 'a working voice was needlessly abandoned')
      assert(withEnglish.texts.length > 0, 'nothing was spoken at all')
      withEnglish.texts.forEach((u, i) => {
        eq(u.text, ZH_EN.phrases[i].e, `phrase ${i} was not the English rendering`)
        eq(u.lang, 'en', `phrase ${i} was not tagged English`)
      })
      eq(withEnglish.finished, true, 'the prayer never finished')
    })

    const onlyChinese = await page.evaluate(
      (o) => window.__run(o),
      {
        prayerId: ZH_EN.id,
        phrases: ZH_EN.phrases,
        lang: ZH_EN.lang,
        speakLang: ZH_EN.speakLang,
        voices: [{ voiceURI: 'zh', lang: 'zh-CN', name: 'Zh', default: false, localService: true }],
        behaviour: 'normal',
        timeout: 30000
      }
    )
    notes.push(
      `speakLang + zh only:   texts=${onlyChinese.texts.map((x) => JSON.stringify(x.text)).join(', ')} lang=${onlyChinese.texts.map((x) => x.lang).join(',')}`
    )
    t('a speakLang=en prayer still speaks English when only a Chinese voice exists', () => {
      // This is the path a real phone takes most often, and the one that would
      // otherwise read the pinyin aloud in an English accent - a different
      // sentence wearing the same clothes.
      eq(onlyChinese.reason, null, 'a Chinese voice should not force the chant')
      assert(onlyChinese.texts.length > 0, 'nothing was spoken at all')
      onlyChinese.texts.forEach((u, i) => {
        eq(u.text, ZH_EN.phrases[i].e, `phrase ${i} should still be the English rendering`)
        eq(u.lang, 'zh', 'with no English voice the engine keeps the prayer language')
      })
      eq(onlyChinese.finished, true, 'the prayer never finished')
    })

    t('misbehaving engines raised no uncaught errors', () => {
      eq(errors.length, 0, `uncaught: ${errors.join(' | ')}`)
    })
  })
} finally {
  killTree(proc)
}

console.log('')
notes.forEach((n) => console.log(`  ${n}`))
console.log('')
console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)