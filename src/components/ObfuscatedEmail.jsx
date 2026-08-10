import React, { useState } from 'react'
import { useT } from '../i18n.js'

// Renders the support email without ever placing the raw address in the DOM as
// plain text, so simple scrapers / spambots don't harvest it. The address is
// reassembled in JS at render time and the link target is only built on click.
// A hidden honeypot field is also rendered so naive bots that "fill everything"
// get swallowed silently.
const local = 'care'
const domain = 'joining-palms'
const tld = 'app'

export default function ObfuscatedEmail({ className }) {
  const t = useT()
  const [built, setBuilt] = useState(false)
  const address = `${local}@${domain}.${tld}`
  const handleClick = (e) => {
    // build the mailto on first interaction (never a static href to scrape)
    e.currentTarget.href = `mailto:${address}`
    setBuilt(true)
  }

  return (
    <>
      <a
        className={className}
        href="#"
        onClick={handleClick}
        rel="noopener noreferrer"
        aria-label={t('legal.contactEmail')}
      >
        {built ? address : `${local} [at] ${domain} [dot] ${tld}`}
      </a>
      {/* Honeypot: real users never see or touch this; bots that fill it are bots. */}
      <input
        type="text"
        name="contact-website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }}
        value=""
        onChange={() => {}}
      />
    </>
  )
}
