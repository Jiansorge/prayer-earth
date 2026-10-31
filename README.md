# Joining Palms

[![CI](https://github.com/Jiansorge/prayer-earth/actions/workflows/test.yml/badge.svg)](https://github.com/Jiansorge/prayer-earth/actions/workflows/test.yml)
[![Live](https://img.shields.io/badge/live-joining--palms.app-DFB05C)](https://joining-palms.app)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

**Pray with the whole world.** A multilingual, installable PWA where people of
every tradition pray together on one living Earth — live at
[`https://joining-palms.app`](https://joining-palms.app).

## Preview

![World view — the Earth glows as the world prays](public/screenshot.png)

![Demo — praying together, 5 sec](public/demo.gif)

*Live is the demo — open `https://joining-palms.app`, pick a tradition, press Pray, and watch the Earth glow. Regenerate with `npm run capture:demo`.*

- 🌍 A real-time 3D Earth that glows as the world prays (WebGL shaders, prayer
  lights, a twinkling golden aura).
- 🙏 **256 prayers** across **19 traditions** — ancient public-domain scripture
  and original compositions. Everything is deliberately
  **non-copyrighted, non-dogmatic, and never shame- or sin-focused**.
- 🌐 **15 interface languages** (en, es, fr, de, hi, pt, it, ru, zh, ar, ja, ko,
  vi, tl, bo) with RTL support for Arabic.
- 📱 Installable PWA, offline-ready via a service worker; works on phones and
  desktop. Also on **Google Play** (Android, in closed testing — see
  [RELEASE.md](RELEASE.md)).
- 🔒 Privacy-first: only a coarse 1° location cell is ever shared; no accounts,
  no precise location, no personal data. Raw IPs are never logged.

## Stack

| piece | tech |
|---|---|
| App | React 18, Vite, three.js, Zustand |
| Android | Capacitor 8 wrapper (`android/`, `app.joiningpalms`) → AAB on Google Play; a macrobenchmark module records a Baseline Profile (see [docs/PERFORMANCE.md](docs/PERFORMANCE.md)) |
| Real-time sync | [`sync-engine`](https://github.com/Jiansorge/sync-engine) — Cloudflare Workers + Durable Objects (WebSocket presence, live feed, durable anonymous totals) |
| Voices | pre-rendered neural MP3s (`public/audio/`, `manifest.json`) + on-device TTS fallback |
| Install/offline | service worker (`public/sw.js`), Web App Manifest |
| CI | GitHub Actions: build + server tests + i18n audit + browser suites on every push; a `main` push auto-deploys **staging** (`staging.joining-palms.app`), production is a deliberate promote |

## Project

**Goal:** Manifest divine energy for the multiverse — a single, privacy-first place where anyone, of any tradition or none, can pray together and *see* the world light up.

* **World view (3D globe):** `three.js` + custom GLSL — equirect 2048×1024 land mask (Natural Earth 110m), correct `lon` chirality, cloud + aurora shaders, 256 instanced prayer lights with precomputed `localDir` (one `drawElements` pass, 60fps). Collective glow = `pow(count/1M, 0.38)` in `src/store.js`. Offline PWA via `public/sw.js`.
* **Prayers:** 19 traditions → 256 prayers, code-split per spirit (`src/data/spirits/*.js` lazy via `loadSpirit()`), 15 locales with RTL, no copy-pasted copyrighted texts.
* **Sync:** App never talks to DB — only to `sync-engine` (Workers + Durable Objects) via tiny `src/sync/` interface. Swap `SyncEngine`→`CfEngine` with no app change.

## Private data

This repo is **public and contains zero secrets** — safe to share for job applications.

| What | How we handle it |
|---|---|
| **No accounts, no emails, no names** | Display name is user-chosen, stored only in `localStorage` (`prayer-earth-v1`), never required. |
| **Location** | Only a coarse **1° grid cell** (`gridKey`) derived from `navigator.geolocation` or timezone fallback; precise lat/lng never leaves device. Raw IPs never logged — upgrade throttle hashes IP with SHA-256. |
| **Prayer history** | `prayerCompletions`, `prayerDayStats` in `localStorage` only; anonymous counters merged via `mergeStats` (max-merge, no PII) to Durable Objects. |
| **Network** | Strict CSP (no `unsafe-inline`/`unsafe-eval`), `nosniff`, `DENY` framing, referrer policy; all feed content via React escaping (no `dangerouslySetInnerHTML`). |
| **Secrets** | None in repo — `VITE_SYNC_URL` is public `wss://joining-palms.app`, `wrangler.toml` vars are non-secret (`PROTOCOL_VERSION`, rate limits). Real tokens (`CF_API_TOKEN`, `ADMIN_KEY`) live in `wrangler secret` / GitHub Secrets, never committed. `.env*` is gitignored. |
| **Compliance** | GDPR-friendly: data stays on device; anonymous aggregates kept forever in DO storage + optional KV backup `TOTALS_BACKUP` for disaster recovery. See `sync-engine/docs/SECURITY.md`. |

> **For reviewers:** Clone, `npm install`, `npm start` — no keys needed. `npm run build` + `npm test` run fully offline.

## Development

```bash
npm install
npm start          # vite dev server (port 5173)
npm test           # server tests + usage checks
npm run test:proof # industrial proof: real-browser playback/earth/nav loops
npm run test:proof2
npm run audio      # render prayer MP3s (scripts/generate-audio.mjs)
```

In dev the app runs its own Node sync server so nothing needs Cloudflare until
you deploy.

To put a build on a **real phone** (debug APK loop, local release install, or
Play track) see [RELEASE.md](RELEASE.md) → "Test on a phone".

## Content guidelines (please read before adding prayers)

Every prayer in this library is curated with care:

1. **Public domain or original.** No copyrighted texts — nothing modern whose
   rights are owned (e.g. no Bahá'í authorized translations, no 20th-century
   authored prayers). Ancient scripture and hymns (Bible, Qur'an, Vedas, Guru
   Granth Sahib, etc.) are fine; everything else is an original composition
   written for the app.
2. **Wholesome.** Nothing about being a sinner, no shame, guilt, or
   self-punishment, no fear-mongering.
3. **Respectful.** Indigenous and living traditions are represented with care
   and gratitude, never mocked or co-opted.
4. **Format.** See `src/data/prayers.js` — each prayer is an object with `id`,
   `title`, `lang`, `langLabel`, `phrases` (`{ t: spoken, s?: transliteration,
   e?: meaning }`), and a short `translation`. Add new MP3 audio with
   `npm run audio` (`AUDIO_PRAYERS=id1,id2` renders only those).

## Deployment

There are two deployments and they share one build directory, which is the
single most confusing thing about shipping this app. `dist/` is written by both:

```
npm run build        (web)     -> staged into ../sync-engine/public -> Cloudflare Worker
npm run build:release (Android) -> dist -> npx cap sync android -> gradlew bundleRelease -> Play
```

**A web deploy rewrites `dist/`.** After one, `npm run check:android:sync` reports
that `dist/` and the packaged Android assets are different builds — correctly, and
it is Gradle that will refuse the next Android build. Re-run
`npm run build:release && npx cap sync android` before building the AAB again.

The gates, in order, and what each one exists to catch:

| gate | catches |
|---|---|
| `npm run check:android:sync` | `npx cap sync android` was skipped; Gradle would package stale web assets |
| Gradle `preBuild` | the same thing, at build time, so no APK is produced |
| `npm run test:android:assets` | manifest permissions, missing chunks, wrong sync endpoint |
| `npm run verify:aab` | opens the AAB and reads it — the only gate that inspects the artifact |
| `npm run verify:aab-tamper` | that `verify:aab` still fails when it should |
| `npm run verify:aab-guard` | that the shipped-hook checks are real (a tampered chunk is rejected) |

[RELEASE.md](RELEASE.md) is the release guide: the full Android/Play sequence,
the **phone-testing paths** (debug APK loop / local release install via
bundletool / Play track), the toolchain requirements (JDK, which `gh` account
to push as), and what each check proves.

The app and the sync engine ship together from `sync-engine`:

```bash
cd ../sync-engine
npm run ship        # test → build app (cf engine) → stage → deploy
```

`npm run ship` rebuilds the app, stages it into the Worker's assets (with a
rollback backup), and deploys to `joining-palms.app`. Audio rides along; after
changing the MP3 library, bump `public/sw.js`'s cache version and purge the
Cloudflare `/audio/*` cache (see `sync-engine/docs/DEPLOYMENT.md`).

**Pushes to `main` deploy staging, not production.** Since 2026-10-26 the flow
is stage-first: `test.yml` runs the build, the static audits, the server tests
and the five browser suites (a **parallel** matrix — they are independent, so
running them serially bought only wall-clock time), then dispatches a deploy to
`sync-engine` (via the `DEPLOY_PAT` repo secret) that lands on
**`staging.joining-palms.app`**. Verify the change there, then promote:

```bash
cd ../sync-engine
gh workflow run deploy --repo Jiansorge/sync-engine -f target=production   # or: npm run ship
```

The production deploy always runs in `sync-engine` behind three post-deploy
gates — version contract, live endpoints, and a **live browser smoke** (the
rendered backdrop on the real URL, with automatic rollback if any gate fails) —
plus a 5-minute uptime watch that opens a GitHub issue on regression and closes
it on recovery. See
[`sync-engine/docs/DEPLOYMENT.md`](https://github.com/Jiansorge/sync-engine/blob/main/docs/DEPLOYMENT.md).

## Security & privacy

The app is privacy-first and hardened by default:

- **No accounts, no personal data** — only a coarse 1° location cell and
  anonymous counters ever leave a device; raw IPs are never logged.
- **Strict Content Security Policy** on the app shell (no inline scripts,
  no `unsafe-inline`/`unsafe-eval`), plus `nosniff`, `DENY` framing, and a
  referrer policy.
- **XSS-safe by construction** — all user/feed content renders through React's
  escaping (no `dangerouslySetInnerHTML`); display names are sanitized.
- **Server-side hardening** lives in the sync engine (origin checks, rate
  limiting, prototype-pollution stripping, constant-time secrets) — see
  [`sync-engine/docs/SECURITY.md`](https://github.com/Jiansorge/sync-engine/blob/main/docs/SECURITY.md).

See [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) for how the app stays fast,
including code-splitting, caching, and slow-device handling.

## License

App code is open source; prayer texts are public domain or original.
