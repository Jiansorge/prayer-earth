// Tiny built-in internationalization, no dependencies, offline, persisted.
// The app's interface text lives here; prayer texts stay in their own
// languages (with transliteration + English meaning in the data).

import { useStore } from './store.js'

import { useEffect } from 'react'

// English is bundled inline so the first paint never waits on a network trip;
// every other locale loads on demand as a small chunk the first time it's picked.
import en from './locales/en.js'

const loaded = { en }
const pending = new Map()
function loadLocale(code) {
  if (code === 'en' || loaded[code]) return Promise.resolve()
  if (pending.has(code)) return pending.get(code)
  const p = import(`./locales/${code}.js`)
    .then((m) => {
      loaded[code] = m.default
      useStore.getState().bumpLocaleReady()
    })
    .catch(() => {})
  pending.set(code, p)
  return p
}

export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'bo', label: 'བོད་སྐད' }
]

// RTL locales whose interface should flow right-to-left.
export const RTL_LOCALES = new Set(['ar', 'fa', 'ur', 'he'])

// The legal text is English in every language, on purpose.
//
// The hosted policy (public/privacy.html, built from en.js by build-legal.mjs) is
// already English-only, and that is the copy the Play listing links to and the
// copy Google reads for Data Safety. The in-app sheet used to carry its own
// machine-translated legal.* strings in fourteen languages, which meant ~1100
// unreviewed renderings of a document nobody had checked, free to drift from the
// hosted copy it claimed to match.
//
// Falling back to English makes the two provably identical instead of merely
// intended to be, and removes a whole class of thing that can be subtly wrong
// rather than merely clumsy. A wrong claim about what happens to someone's
// location is a different problem from a bad translation, and machine
// translation produced both: an Arabic string with the product name welded
// mid-word, and one with a mangled unit.
//
// legal.langNote is the exception: it is the sentence telling the reader that
// English governs, so it must stay in the reader's language.
const LEGAL_ENGLISH_ONLY = /^legal\.(?!langNote$)/
export const legalIsEnglishOnly = (key) => LEGAL_ENGLISH_ONLY.test(key)

export function translate(key, params) {
  const locale = useStore.getState().locale
  const table = loaded[locale] || en
  const str = legalIsEnglishOnly(key)
    ? en[key] ?? key
    : table[key] ?? en[key] ?? key
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (m, k) =>
    params[k] != null ? String(params[k]) : m
  )
}

// Re-renders the caller when the chosen language changes (and when its strings
// finish loading on first use).
export function useT() {
  const locale = useStore((s) => s.locale)
  useStore((s) => s.localeReady)
  useEffect(() => {
    loadLocale(locale)
  }, [locale])
  return translate
}

// Localized title for a prayer, falling back to its original title in the
// data. Only prayers that opt in (currently the original nonreligious ones)
// have `ptitle.*` keys; everything else keeps its original name.
export function prayerTitle(t, prayerId, fallback) {
  const v = t(`ptitle.${prayerId}`)
  return v === `ptitle.${prayerId}` ? fallback : v
}
