# Joining Palms

**Pray with the whole world.** A multilingual, installable PWA where people of
every tradition pray together on one living Earth — live at
[`https://joining-palms.app`](https://joining-palms.app).

- 🌍 A real-time 3D Earth that glows as the world prays (WebGL shaders, prayer
  lights, a twinkling golden aura).
- 🙏 **145 prayers** across **15 traditions** — ancient public-domain scripture
  and original wholesome compositions. Everything is deliberately
  **non-copyrighted, non-dogmatic, and never shame- or sin-focused**.
- 🌐 **12 interface languages** (en, es, fr, de, hi, pt, it, ru, zh, ar, ja, ko)
  with RTL support for Arabic.
- 📱 Installable PWA, offline-ready via a service worker; works on phones and
  desktop.
- 🔒 Privacy-first: only a coarse 1° location cell is ever shared; no accounts,
  no precise location, no personal data. Raw IPs are never logged.

## Stack

| piece | tech |
|---|---|
| App | React 18, Vite, three.js, Zustand |
| Real-time sync | [`sync-engine`](https://github.com/Jiansorge/sync-engine) — Cloudflare Workers + Durable Objects (WebSocket presence, live feed, durable anonymous totals) |
| Voices | pre-rendered neural MP3s (`public/audio/`, `manifest.json`) + on-device TTS fallback |
| Install/offline | service worker (`public/sw.js`), Web App Manifest |
| CI | GitHub Actions: build + server tests + i18n audit on every push |

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

The app and the sync engine ship together from `sync-engine`:

```bash
cd ../sync-engine
npm run ship        # test → build app (cf engine) → stage → deploy
```

`npm run ship` rebuilds the app, stages it into the Worker's assets (with a
rollback backup), and deploys to `joining-palms.app`. Audio rides along; after
changing the MP3 library, bump `public/sw.js`'s cache version and purge the
Cloudflare `/audio/*` cache (see `sync-engine/docs/DEPLOYMENT.md`).

## License

App code is open source; prayer texts are public domain or original.
