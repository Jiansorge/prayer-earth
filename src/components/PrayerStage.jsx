// The prayer itself: title, language badge, live lines with meaning lines,
// completion band, translation, done card, and the together counts. Owns the
// lines ref and centring effect because they exist to scroll these lines.
import React, { useEffect, useRef } from 'react'
import { useT, prayerTitle } from '../i18n.js'
import { tPrayer, tPhrase } from '../i18n/prayerL10n.js'
import { fillPractitionerName, practitionerName } from '../shared/prayerName.js'
import { useStore } from '../store.js'
import PrayerStats from './PrayerStats.jsx'

const fmt = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export default function PrayerStage({ prayer, phrases, active, rtl, locale, chantMode, chantReason, playing, finished, elapsed, setFinished, prayerCount, spiritCount, spirit, prayerToday }) {
  const t = useT()
  const profileName = useStore((s) => (s.profile ? s.profile.name : ''))
  const sharePresence = useStore((s) => s.sharePresence)
  // Prayers that call for the practitioner's name read it here, gated by the
  // same consent that governs whether the name is ever shown to anyone else.
  // '' keeps the plain ellipsis, so an opted-out device reads as it always has.
  const named = practitionerName(profileName, sharePresence)

  // While playing, keep the phrase being voiced centred on screen.
  const linesRef = useRef(null)
  useEffect(() => {
    if (!playing || active == null) return
    const el = linesRef.current?.querySelector('.prayer-line.on')
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active, playing])
  return (
    <>
    {/* tabIndex: this is the scroll container for the whole prayer. A
        keyboard-only user cannot scroll a region they cannot focus, so
        without it a long prayer is unreachable past the visible lines, and
        screen readers announce the region without saying it scrolls.
        This must stay a JSX comment - a bare `//` here is not a comment at
        all, it is a text node, and it renders on the page. */}
    <div
      className="prayer-stage fade-in"
      key={prayer.id}
      tabIndex={0}
      role="group"
      aria-label={prayer.name || t('prayer.title')}
    >
      {prayer.loop && (
        <div className="loop-dots">
          {phrases.map((_, i) => (
            <span
              key={i}
              className={`loop-dot ${active === i ? 'lit' : ''}`}
            />
          ))}
        </div>
      )}

      <h1 className="prayer-title">{prayerTitle(t, prayer.id, prayer.title)}</h1>
      <div className="prayer-sub">
        <span className="prayer-lang-badge">
          {String(prayer.langLabel || '').split(' � ').slice(0, 2).join(' � ')}
        </span>
        {chantMode && chantReason !== 'chosen' && (
          <span className="prayer-mode">{t('prayer.voiceUnavailable')}</span>
        )}
      </div>
      <span className="sr-live" aria-live="polite">
        {playing && active != null && phrases[active]
          ? fillPractitionerName(phrases[active].t, named)
          : ''}
      </span>

      <div className="prayer-lines" ref={linesRef}>
        {phrases.map((ph, i) => (
          <div
            key={i}
            className={`prayer-line ${active === i ? 'on' : ''}`}
            dir={rtl ? 'rtl' : 'ltr'}
            lang={prayer.lang}
          >
            <span className="hlt">{fillPractitionerName(ph.t, named)}</span>
            {ph.s && (
              <span className="sub">
                {fillPractitionerName(ph.s, named)}
              </span>
            )}
            {ph.e && (
              <span className="en">
                {fillPractitionerName(tPhrase(ph.e, locale), named)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* The words end here. Without a mark, the prayer just stopped being
          highlighted and the stage continued at the same brightness, so the
          reader had to notice the silence themselves. A darker band under
          the last line is the page saying the recitation is complete. */}
      <div className="prayer-end-band" aria-hidden="true" />

        <div className="prayer-translation">{tPrayer(prayer, locale)}</div>

      {finished && !playing && (
        <div className="done-card fade-in">
          <div className="done-emoji">🕊️</div>
          <div className="done-title">{t('prayer.doneTitle')}</div>
          <div className="done-sub">
            {t('prayer.doneSub', { time: fmt(elapsed) })}
          </div>
          <button onClick={() => setFinished(false)}>{t('prayer.keepListening')}</button>
        </div>
      )}

      {chantMode && (
        <div className="chant-pill">{t('prayer.softChant')}</div>
      )}

      <div className={`praying-now ${prayerCount ? 'together' : ''}`} title={t('prayer.prayingNowTitle')}>
        <span className="pulse-dot" />
        <b
          style={{
            textShadow: `0 0 ${6 + Math.min(1, Math.log10((prayerCount || 0) + 2) / 4) * 16}px rgba(232,196,122,${0.3 + Math.min(1, Math.log10((prayerCount || 0) + 2) / 4) * 0.7})`
          }}
        >
          {prayerCount || 0}
        </b>{' '}
        <span className="praying-now-rest">
          {t('prayer.prayingNowRest')}
          <span className="praying-now-sub">
            {t('prayer.across', { n: spiritCount || 0, name: spirit.name })}
          </span>
        </span>
        <span
          className="praying-now-total"
          title={t('prayer.today', { n: prayerToday.toLocaleString() })}
          style={{
            textShadow: `0 0 ${5 + Math.min(1, Math.log10(prayerToday + 2) / 5) * 12}px rgba(232,196,122,${0.25 + Math.min(1, Math.log10(prayerToday + 2) / 5) * 0.6})`
          }}
        >
          {t('prayer.today', { n: prayerToday.toLocaleString() })}
        </span>
      </div>

      <PrayerStats prayerId={prayer.id} />
    </div>
    </>
  )
}
