# Release guide (Android / Play Store)

The app builds and is release-ready from the code side. `assembleRelease` succeeds
(with a debug-signing fallback). Publishing needs three things that only you can
provide, because they are secrets/accounts:

## 1. Create a release keystore (one-time, back it up)
```bash
keytool -genkey -v -keystore release.keystore -alias joining-palms \
  -keyalg RSA -keysize 2048 -validity 10000
```
Put it OUTSIDE the repo (it's gitignored). Save the passwords.

## 2. Point the build at the keystore
Create `android/key.properties` (gitignored):
```
storeFile=/absolute/path/to/release.keystore
storePassword=…
keyAlias=joining-palms
keyPassword=…
```
`android/app/build.gradle` picks it up automatically when the file exists; without
it a release build is signed with the debug key (fine for testing, NOT publishable).

## 3. Set the Play Store listing URL at build time
The "Share on Play Store" button reads `VITE_PLAY_STORE_URL`. Until you set it the
UI shows "coming soon". Build with:
```
VITE_SYNC_ENGINE=cf VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=app.joiningpalms npm run build:capacitor
npx cap sync android
```

## 4. (Recommended) Enable verified deep links
Deep links (`https://joining-palms.app/#/pray/...`) currently work via the Android
app-links chooser because `autoVerify` is intentionally off. To remove the chooser:
- Host `/.well-known/assetlinks.json` on joining-palms.app containing your release
  signing cert's SHA-256 fingerprint:
  ```bash
  keytool -list -v -keystore release.keystore -alias joining-palms | grep SHA256
  ```
- Add `android:autoVerify="true"` to the intent-filter in
  `android/app/src/main/AndroidManifest.xml` (the `<data>` with
  `host="joining-palms.app"`).

## 5. Build & publish
```bash
# Use the release build. It forces the test hooks OFF and refuses to produce a
# bundle that still contains them, so you cannot ship the backdoor by accident.
npm run build:release
npx cap sync android
cd android && ./gradlew bundleRelease   # .aab for Play
```
Upload `android/app/build/outputs/bundle/release/app-release.aab` to the Play Console.

Verify your signing identity any time (it never prints the password):
```bash
node scripts/check-signing.mjs
```

## Test-observability hooks (security)
The app exposes `window.__store` / `__speech` / `__ambient` (full read/write
handles on prayer state and audio) ONLY when built with test hooks on:
- Vite **dev** server → always on (the browser test suite needs it).
- `VITE_TEST_HOOKS=true` → on for instrumented Android/Capacitor builds used by
  the on-device smoke test. This is set in `.env.capacitor`.

They are gated at **build time** (a previous version gated on a runtime
`?peTest=1` URL param that shipped in the production web bundle and was reachable
via a crafted link — that hole is closed).

**Use `npm run build:release` for anything you publish.** `npm run build:capacitor`
deliberately leaves the hooks ON for the device smoke test, so building with it
and uploading that `dist` would ship `window.__store` to the public app. The
release script overrides the flag and then runs `scripts/audit-build.mjs`, which
fails the build if any hook is present — you do not have to remember.

## Protecting against re-uploads (honest scope)
The app ships free and stays free. You cannot stop someone repackaging the APK —
any Android build can be unpacked, and the app's own code is already minified, so
a copy is not a readable source drop. What is in place:
- `scripts/audit-build.mjs` asserts no test hooks and that app code is minified,
  so the published bundle is not an easier target than it needs to be.
- Settings → About carries attribution ("Free, always") and a report-a-copy link
  (`https://joining-palms.app/legal#report`), which is what makes a Play takedown
  straightforward if a copy is published.

Neither is a wall. Treat them as a speed bump plus a paper trail.

## Notes
- `versionCode 24` / `versionName 1.0.0` in `android/app/build.gradle` — bump the
  code for every Play upload (it must strictly increase).
- The release keystore is the one unrecoverable asset: if it is lost, Play rejects
  every future update of the listing. Back it up in two places, and keep the
  password in a password manager — not only on the machine that built it.
- Prayer audio (~112 MB) is bundled in the APK for offline use and is also pushed to
  the CDN. The 9 Gurmukhi Sikh mantras have no free neural voice and use on-device
  TTS by design.
