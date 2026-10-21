import React from 'react'
import { LOCALES } from '../i18n.js'

// The locale picker, shared by first-run onboarding and the settings sheet.
// Both call sites supply their own id, label and hint; the select itself -
// options, value binding and change handler - is identical, so it lives here
// once and renders the exact same DOM in both places.
export default function LocaleSelect({ id, locale, setLocale }) {
  return (
    <select
      id={id}
      className="field-select"
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
