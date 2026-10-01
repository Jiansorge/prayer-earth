// Build standalone, always-available Privacy Policy and Terms pages.
//
// The in-app policy lives at #/privacy and #/terms, but an app store needs a
// plain HTTPS URL a reviewer (or a crawler) can open without running the SPA.
// These pages are generated from the same English strings the app renders, so
// they can never drift from the in-app text. Output lands in public/, which
// Vite copies into dist/ (and the deploy stages into the Worker's public/), so
// the live URLs are:
//   https://joining-palms.app/privacy.html
//   https://joining-palms.app/terms.html
//
// Run automatically at the start of every `vite build` (see package.json).

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import en from '../src/locales/en.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public')

const t = (k) => en[k] ?? ''
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const CONTACT = t('legal.contactEmail')

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 3rem 1.25rem 4rem;
  background: #07150d; color: #e8f0ea;
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
main { max-width: 720px; margin: 0 auto; }
.brand { display: flex; align-items: center; gap: .6rem; margin-bottom: 2rem; }
.brand img { width: 40px; height: 40px; border-radius: 10px; }
.brand a { color: #e8f0ea; text-decoration: none; font-weight: 600; letter-spacing: .01em; }
h1 { font-size: 1.7rem; margin: 0 0 .25rem; }
h2 { font-size: 1.15rem; margin: 2.2rem 0 .6rem; color: #bfe6cf; }
p, li { color: #cdd8d1; }
ul { padding-left: 1.25rem; }
li { margin: .35rem 0; }
a { color: #8fd6ab; }
.meta { color: #7f927f; font-size: .85rem; margin-top: .35rem; }
.contact a { color: #8fd6ab; }
footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #1c3227; font-size: .85rem; color: #7f927f; }
@media (prefers-color-scheme: light) {
  body { background: #f7faf8; color: #10241a; }
  h1, .brand a { color: #10241a; }
  h2 { color: #1f5c3a; }
  p, li { color: #2c3d33; }
  a, .contact a { color: #1f6f45; }
  .meta, footer { color: #5d7166; }
  footer { border-top-color: #d9e5dd; }
}
`.trim()

function page({ title, heading, body, description }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#07150d" />
    <meta name="robots" content="index, follow" />
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="https://joining-palms.app/${title}.html" />
    <title>${esc(heading)} | Joining Palms</title>
    <style>${STYLE}</style>
  </head>
  <body>
    <main>
      <div class="brand">
        <img src="/icons/icon-192.png" alt="" width="40" height="40" />
        <a href="https://joining-palms.app/">Joining Palms</a>
      </div>
      <h1>${esc(heading)}</h1>
      <p class="meta">Effective as of publication.</p>
${body}
      <footer>
        <p>Joining Palms &middot; <a href="https://joining-palms.app/">joining-palms.app</a> &middot;
        <a href="/privacy.html">Privacy</a> &middot; <a href="/terms.html">Terms</a></p>
      </footer>
    </main>
  </body>
</html>
`
}

const privacyItems = ['priv1', 'priv2', 'priv3', 'priv4', 'priv5', 'priv6', 'priv7', 'priv8', 'priv9', 'priv10', 'priv11']

const privacyBody = `
      <p>${esc(t('legal.pIntro'))}</p>
      <section>
        <h2>1. ${esc(t('legal.pWhatTitle'))}</h2>
        <ul>${privacyItems.map((k) => `\n          <li>${esc(t('legal.' + k))}</li>`).join('')}
        </ul>
      </section>
      <section>
        <h2>2. ${esc(t('legal.pUseTitle'))}</h2>
        <p>${esc(t('legal.pUseBody'))}</p>
      </section>
      <section>
        <h2>3. ${esc(t('legal.pBasisTitle'))}</h2>
        <p>${esc(t('legal.pBasisBody'))}</p>
      </section>
      <section>
        <h2>4. ${esc(t('legal.pRightsTitle'))}</h2>
        <p>${esc(t('legal.pRightsBody'))}</p>
      </section>
      <section>
        <h2>5. ${esc(t('legal.pGdprTitle'))}</h2>
        <p>${esc(t('legal.pRightsEu'))}</p>
        <p>${esc(t('legal.pRightsCa'))}</p>
        <p>${esc(t('legal.pRightsIntl'))}</p>
        <p>${esc(t('legal.pLgpdBody'))}</p>
      </section>
      <section>
        <h2>6. ${esc(t('legal.pCookTitle'))}</h2>
        <p>${esc(t('legal.cookBody'))}</p>
      </section>
      <section>
        <h2>7. ${esc(t('legal.pKidsTitle'))}</h2>
        <p>${esc(t('legal.ageBody'))}</p>
      </section>
      <section>
        <h2>8. ${esc(t('legal.pProcTitle'))}</h2>
        <p>${esc(t('legal.processingBody'))}</p>
      </section>
      <section>
        <h2>9. ${esc(t('legal.pBreachTitle'))}</h2>
        <p>${esc(t('legal.pBreachBody'))}</p>
      </section>
      <section>
        <h2>10. ${esc(t('legal.pDpoTitle'))}</h2>
        <p>${esc(t('legal.pDpoBody'))}</p>
      </section>
      <section class="contact">
        <h2>11. ${esc(t('legal.pContactTitle'))}</h2>
        <p>For business inquiries, prayer additions, questions, or any data-protection matter, email us at
        <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>. We&rsquo;ll get back to you.</p>
      </section>`

const termsSections = [
  ['tUseTitle', 'tUseBody'],
  ['tContentTitle', 'tContentBody'],
  ['tLiabilityTitle', 'tLiabilityBody'],
  ['tChangesTitle', 'tChangesBody'],
  ['tAbuseTitle', 'tAbuseBody'],
  ['tGoverningTitle', 'tGoverningBody'],
  ['tDisputeTitle', 'tDisputeBody'],
  ['tSeverTitle', 'tSeverBody'],
  ['tForceTitle', 'tForceBody'],
  ['tDmcaTitle', 'tDmcaBody'],
  ['tAiTitle', 'tAiBody'],
  ['tTransTitle', 'tTransBody'],
  ['tChangesTitle2', 'tChangesBody2'],
  ['tEffectiveTitle', 'tEffectiveBody']
]

const termsBody = `
      <p>${esc(t('legal.tIntro'))}</p>
${termsSections
  .map(
    ([titleKey, bodyKey], i) => `      <section>
        <h2>${i + 1}. ${esc(t('legal.' + titleKey))}</h2>
        <p>${esc(t('legal.' + bodyKey))}</p>
      </section>`
  )
  .join('\n')}`

mkdirSync(OUT_DIR, { recursive: true })

writeFileSync(
  path.join(OUT_DIR, 'privacy.html'),
  page({
    title: 'privacy',
    heading: t('legal.privacyTitle'),
    description: 'How Joining Palms handles your information: anonymous, device-first, no accounts, no ads.',
    body: privacyBody
  })
)

writeFileSync(
  path.join(OUT_DIR, 'terms.html'),
  page({
    title: 'terms',
    heading: t('legal.termsTitle'),
    description: 'The terms of service for Joining Palms.',
    body: termsBody
  })
)

// A standalone, plain-HTML data-deletion request page.
//
// Play requires this URL on the store listing: it must name the app, give the
// steps prominently, and state what is deleted, what is kept, and any retention
// period. It is a static file rather than a route in the SPA so the link keeps
// working even if the app bundle fails to load, and it is generated here so the
// privacy policy and this page can never drift apart.
// (CONTACT is already defined above from legal.contactEmail, so the same
// address serves the privacy policy, the terms and this page.)

const deleteBody = `
      <p><strong>Joining Palms has no accounts, no sign-in, and no email address.</strong>
      We identify your records only by a random anonymous ID that was generated
      on your device. To delete them, we need that ID, and you are the only
      person who has it.</p>

      <h2>1. Get your anonymous ID</h2>
      <p>Open <strong>Joining Palms</strong> &rarr; <strong>Settings</strong> &rarr;
      <strong>Backup &amp; restore</strong>, then tap
      <strong>Copy anonymous ID</strong> and paste the code here in your email.</p>
      <p>If you cannot find that button, a <strong>recovery code</strong> works just as
      well: Settings &rarr; Backup &amp; restore &rarr; <strong>Copy recovery code</strong>,
      and email us the whole thing. It contains the same anonymous ID.</p>

      <h2>2. Send it to us</h2>
      <p>Email <a href="mailto:${CONTACT}?subject=Delete%20my%20Joining%20Palms%20data">${CONTACT}</a>
      with the subject <strong>Delete my Joining Palms data</strong> and the
      anonymous ID in the body. No other information is needed, and we will not
      ask you for one.</p>

      <h2>3. We delete it</h2>
      <p>We remove the record within <strong>30 days</strong> and email you to
      confirm once it is gone. If we cannot find a record for the ID you sent, we
      will tell you that too.</p>

      <h2>What we delete</h2>
      <ul>
        <li>Your lifetime prayer record: the anonymous ID, prayer counts, total
            prayer time, your streak and best streak, and your per-day history.</li>
        <li>The rate-limiting entry held against that anonymous ID.</li>
        <li>Your live presence on the map and your entry in the activity feed.
            These are held only while the app is open and are normally removed
            within <strong>60 seconds</strong> of you stopping.</li>
      </ul>

      <h2>What we keep, and why</h2>
      <ul>
        <li><strong>The worldwide prayer total.</strong> This is a single running
            total shared by every person using the app. Prayers already added to
            it cannot be subtracted without lowering the number for everyone
            else, so that aggregate figure remains unchanged. It cannot be traced
            back to you.</li>
        <li><strong>Backups you made yourself.</strong> Recovery codes and backup
            files live on your device. We never receive them unless you choose to
            email one to us.</li>
        <li><strong>Network information such as your IP address</strong> may be
            retained briefly by our hosting provider for security and abuse
            prevention. This is kept separately from your prayer record and holds
            no prayer data.</li>
      </ul>

      <h2>Data still on your device</h2>
      <p>Deleting your server record does not erase what is already on your
      phone or browser &mdash; that is stored locally, not on our servers. To remove
      it, clear the app's storage in your Android Settings, or clear site data for
      joining-palms.app in your browser. Once you clear it, the recovery code is
      your only copy.</p>

      <h2>Retention summary</h2>
      <ul>
        <li>Live presence and activity feed: about 60 seconds.</li>
        <li>Your lifetime prayer record: kept while you use the app; deleted
            within 30 days of a request.</li>
        <li>Worldwide prayer total: retained, anonymous and not attributable.</li>
      </ul>`

writeFileSync(
  path.join(OUT_DIR, 'delete-data.html'),
  page({
    title: 'delete-data',
    heading: 'Delete your Joining Palms data',
    description: 'How to request deletion of your Joining Palms prayer data, what is deleted, and what is kept.',
    body: deleteBody
  })
)

console.log('[build-legal] wrote public/privacy.html, public/terms.html and public/delete-data.html')
