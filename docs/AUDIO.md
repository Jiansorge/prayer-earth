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
