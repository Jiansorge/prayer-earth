# Recordings (spoken prayers)

Prayer Earth ships pre-recorded neural voices for most prayers. They live as
static MP3s in `public/audio/<prayerId>/<phraseIndex>-<voiceId>.mp3` and are
described by `public/audio/manifest.json` (which voices each prayer has). The
build copies `public/` → `dist/`, so they ship with the app. A prayer with no
recordings falls back to on-device browser voices automatically.

## Generate (all, or scoped)

```bash
npm run audio                          # render the whole library (free Edge voices)
AUDIO_PRAYERS=lords-prayer,mani npm run audio   # only these prayers
MAX_VOICES=3 npm run audio             # fewer voice options per prayer
```

Output: `public/audio/<prayerId>/...mp3` + `manifest.json`. Languages Edge has
no voice for are skipped (the app uses device voices for those).

## Remove or replace

```bash
npm run audio:remove -- <prayerId> [voiceId] [phraseIndex] --yes
# examples:
npm run audio:remove -- lords-prayer --yes                     # all recordings for one prayer
npm run audio:remove -- lords-prayer en-US-AriaNeural          # one voice for a prayer
npm run audio:remove -- lords-prayer en-US-AriaNeural 0        # just one phrase of that voice
```

The script deletes the matching MP3s **and keeps `manifest.json` in sync**, so
the app never lists a recording that no longer exists. Deleting every recording
for a prayer switches it back to device-voice fallback (and shrinks the bundle —
the audio folder is most of the app's download size).

**To replace** a recording, either overwrite the file at the same name, or
re-run `npm run audio` scoped to that prayer.

## Deploying changes

After any audio change, rebuild and redeploy:

```bash
npm run build
cd ../sync-engine && npm run deploy:app
```

`deploy:app` stages the fresh `dist/` (including `dist/audio`) into the Worker,
so removed files disappear from production and replaced ones overwrite.

> Tip: an interrupted `generate-audio` run keeps what it wrote (it saves the
> manifest after every prayer). Re-run to finish.

## Size diet (deferred 2026-10-31 — analysis done, decision: keep all voices)

Audio is **~118 MB of the ~126 MB `public/` tree — 94% of the app** (5,941
MP3s; the AAB is 108 MB mostly because of it). Measured facts, so this doesn't
need re-auditing:

- **Root cause:** every prayer ships up to **8 voice variants of the same
  text** (`MAX_VOICES` in `scripts/generate-audio.mjs`, default 8). The four
  fattest English voices alone are 65 MB.
- **Bitrate is not a lever:** `msedge-tts` only offers 48 / 96 kbps mono MP3;
  we already use the smaller one. Voice *count* is the only clean lever.
- **The proposed diet:** `MAX_VOICES=8 → 3` (default female + male + one
  alternate) → English drops ~60 MB, AAB lands near **~50 MB**. The voice
  chips in the tune sheet adapt to any count, and a full re-render is free
  (Edge TTS, no card) and incremental (`existsSync` skips existing files).
- **Hidden bonus of any re-render:** old renders predate the `PRIMARY_REGION`
  pin, so old prayers auto-play *en-AU-Natasha* while new ones play
  *en-US-Ava*. A re-render fixes the inconsistency.
- All 5,942 audio files are git-tracked, so a prune is fully revertible.
- If ever done, the deploy chain is: re-render → prune files not in the new
  manifest → `test:audio:runtime` + `test:android:assets` → `audio:r2:upload`
  → `public/sw.js` CACHE bump → production `/audio/*` CDN purge → and the next
  Play upload needs a **versionCode bump** (see RELEASE.md).

**Decision 2026-10-31:** keep all 8 voices for now — the variety is a product
feature worth the bytes. Revisit if install size ever becomes a complaint.
