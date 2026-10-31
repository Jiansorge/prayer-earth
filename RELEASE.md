# Release guide (Android / Play Store)

The app builds and is release-ready from the code side. `assembleRelease` succeeds
(with a debug-signing fallback). Publishing needs three things that only you can
provide, because they are secrets/accounts:

## 0. The pipeline, and the one thing that bites

There are **two builds of the same app** and they both write to `dist/`:

| target | command | what it becomes |
|---|---|---|
| the web | `npm run build` (with `VITE_SYNC_ENGINE=cf`) | staged into `sync-engine/public/` and served by the Cloudflare Worker |
| Android | `npm run build:release` (hooks forced **off**) | `npx cap sync android` → `gradlew bundleRelease` → the AAB |

**Deploying the web app rewrites `dist/`.** After a deploy, `dist/` is a different
build from the one in `android/app/src/main/assets/public`, and `npm run
check:android:sync` will say so — correctly. That is not a bug to work around; it
is the gate telling you the next Gradle build would package stale web assets.
Re-run `npm run build:release && npx cap sync android` before building again.

Practical consequence: **build and upload the AAB either before or after a web
deploy, not wedged between two of them.**

### Gates, and which one catches what

| gate | runs | catches |
|---|---|---|
| `audit-build.mjs` | inside `build:release` | test hooks in the bundle; unminified source |
| `checkWebAssetsInSync` (Gradle `preBuild`) | every Gradle build | packaged web assets ≠ `dist/` — the silent-staleness bug |
| `test-android-assets.mjs` | CI + before a release | manifest permissions, missing chunks, wrong sync endpoint |
| `verify:aab` | immediately before upload | **opens the AAB** and reads it |
| `verify-aab-tamper.mjs` | any time | that `verify:aab` still goes red when it should |

`verify:aab` is the only one that reads the artifact. It compares every packaged
file byte-for-byte against what is inside the bundle and reports `index.html`'s
sha256, because `index.html` names the entry chunk by content hash — matching it
is what ties the bundle to a specific build rather than to "whatever was around".
A stale bundle can be correctly signed, correctly versioned, hook-free and not
debuggable, and still be last week's app.

### Toolchain notes that are not guessable

- **Gradle needs JDK 11+.** The repo does not pin one, so it comes from
  `org.gradle.java.home` in your **user-level** `~/.gradle/gradle.properties`,
  never from `JAVA_HOME` — `JAVA_HOME` is read by every Java program on the
  machine, and changing it for Gradle's benefit is how a working Tomcat silently
  starts on the wrong JVM. If Gradle says *"requires at least JVM runtime
  version 11"* or *"Unsupported class file major version 69"*, that property is
  missing or pointing at a JDK Gradle cannot use.
- **Pushing needs the account that owns the repo.** `gh auth switch --user Jiansorge`
  before `git push`. The other account on the machine has pull-only.

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
`android/app/build.gradle` picks it up automatically when the file exists.

If the file is **missing**, a release build now **fails immediately** with the
format to use, instead of quietly producing an unsigned bundle that Play rejects
hours later. It also fails if the file is present but incomplete, or if
`storeFile` points at a path that does not exist. Debug builds are unaffected, so
you can still run `assembleDebug` and the emulator smoke test without the key.

Verify what you are shipping rather than trusting the exit code:

```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

The owner should be your release key (`CN=Joining Palms`), **not**
`CN=Android Debug`.

## 3. Set the Play Store listing URL at build time
The "Share on Play Store" button reads `VITE_PLAY_STORE_URL`. Until you set it the
UI shows "coming soon". Build with:
```
VITE_SYNC_ENGINE=cf VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=app.joiningpalms npm run build:capacitor
npx cap sync android
```

## 4. Verified deep links (ENABLED 2026-10-29 — keep these two in sync)

`android:autoVerify="true"` is on the VIEW intent-filter, which makes the
`https://joining-palms.app/#/pray/...` association silent and chooser-free —
**but only while the hosted statement matches the signing key.** Android fetches
`https://joining-palms.app/.well-known/assetlinks.json` at install time; if the
package + fingerprint aren't listed there, the filter does not associate at all
(links open in the browser, no chooser — there is no silent half-state).

- Hosted file: `public/.well-known/assetlinks.json` (deployed with the app).
  It lists **both** keys, so every real install verifies:
  - **upload/local key** (`C:\Users\j\joining-palms-release.keystore`) — builds
    from this machine / adb installs:
    `3F:34:3C:DB:53:57:22:DD:77:5C:41:77:C3:82:95:D4:8B:05:E3:E9:23:5C:C3:D5:D5:27:7E:0B:56:23:BC:BD`
    (re-read any time — password-free: `keytool -printcert -jarfile <the.aab>`)
  - **Play's app-signing key** — what every Play-delivered install is actually
    signed with (Play App Signing re-signs after upload; different key by
    design, not a problem to fix):
    `C0:03:D6:EB:51:7E:51:E7:16:2F:98:46:8E:82:4C:1A:35:97:43:A6:92:1F:E0:64:CC:3B:68:07:7F:87:FE:EE`
    (added 2026-10-31 from **Play Console → Setup → App integrity → App
    signing key certificate** → SHA-256 copy button)
- **Order matters:** get the file live on production *before* installing from
  Play (verification happens at install; a miss isn't retried until
  reinstall/update — force one with `adb shell pm verify-app-links --re-verify
  app.joiningpalms`).
- Rotating the keystore? Update the hosted file **before** shipping the build.

## 5. Build & publish
```powershell
# Use the release build. It forces the test hooks OFF and refuses to produce a
# bundle that still contains them, so you cannot ship the backdoor by accident.
npm run build:release
npx cap sync android
cd android
.\gradlew.bat bundleRelease      # ./gradlew bundleRelease on macOS/Linux
cd ..
```
Then verify the artifact itself before uploading (it is **expected red** if the
bundle is stale — rebuild, never work around it):
```powershell
npm run verify:aab
```
This checks the AAB you are about to ship, not the source you built it from:
signed with the release key rather than the debug key, `versionCode` matches
what Play expects, not debuggable, and **no test hooks compiled in**. It reads
the bundle, so it catches the failure mode that matters most here — shipping
`window.__store`, a full read/write handle on the user's prayer data, because the
wrong build was uploaded.

Upload `android/app/build/outputs/bundle/release/app-release.aab` to the Play Console.

Verify your signing identity any time (it never prints the password):
```bash
node scripts/check-signing.mjs
```

### If `npm run verify:aab` reports "NOT verified in the AAB"

The application id could not be read back out of the bundle, so that one check
only confirmed `build.gradle`. Everything else was still checked against the
real artifact. It is reported rather than hidden because a check that quietly
degrades to checking the source instead of the output is not a check.

## Test on a phone

You cannot install an `.aab` on hardware directly — Play splits and signs it.
Three ways to get a build on a device, in increasing fidelity to what ships:

### A. Debug APK — the daily loop (hooks ON, never upload it)

```powershell
# from prayer-earth root; phone over USB with USB debugging on
npm run build
npm run cap:sync                 # copies dist/ into android/app/src/main/assets/public
cd android
.\gradlew.bat :app:assembleDebug --console=plain     # ~90s warm
cd ..
adb install -r "android\app\build\outputs\apk\debug\app-debug.apk"
adb shell am force-stop app.joiningpalms
adb shell am start -n app.joiningpalms/.MainActivity
```

- `adb` is at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` — not on
  PATH; use the full path or add it.
- The WebView loads assets **out of the APK**: after any `src/` change the
  phone runs a stale bundle until you reinstall. `npm run check:android:sync`
  fails CI if `cap:sync` was skipped.
- This build keeps `VITE_TEST_HOOKS` **on** for the on-device suites
  (`npm run test:android` — full smoke; `node scripts/centering-on-device.mjs`
  — glyph-ink probe) and is signed with the upload key so reinstalls stack
  cleanly. **It must never be uploaded to Play.**

### B. Release build installed locally (closest to Play; needs bundletool)

```powershell
npm run build:release
npx cap sync android
cd android; .\gradlew.bat bundleRelease; cd ..

# one-time: download bundletool.jar from
#   https://github.com/google/bundletool/releases
$J = "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"   # java is not on PATH
& $J -jar bundletool.jar build-apks `
  --bundle=android\app\build\outputs\bundle\release\app-release.aab `
  --output=app.apks --mode=universal `
  --ks=C:\Users\j\joining-palms-release.keystore `
  --ks-pass=pass:<storePassword from android/key.properties> `
  --ks-key-alias=joining-palms `
  --key-pass=pass:<keyPassword from android/key.properties>
& $J -jar bundletool.jar install-apks --apks=app.apks `
  --adb=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
```

- `--mode=universal` yields one APK for any device — what you want for a real
  phone (the split mode only matters for testing density/ABI splits).
- Passing `--ks` is deliberate: without it bundletool signs the generated APKs
  with a throwaway **debug** key, and the phone ends up juggling identities.
  The passwords are the same ones `npm run check:signing` validates.
- **Signature caveat:** everything built here is signed with the **upload**
  key; a copy installed from Play is signed with Play's **app-signing** key.
  Android treats them as different apps — uninstall the Play copy first, or
  test on a device that never installed from Play.

### C. Play closed testing — the real thing

Upload the AAB to a testing track in the Play Console and install from Play.
This is the only path signed with Play's app-signing key. Console steps:
[`docs/PLAY-STORE.md`](docs/PLAY-STORE.md).

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
- `versionCode 31` / `versionName 1.0.0` in `android/app/build.gradle` — bump
  the code for every Play upload (it must strictly increase; confirm Play's
  latest figure in the console first — it cannot be read from here).
  `verify:aab` and `audit:aab` assert the same number against **hardcoded**
  expectations (`scripts/verify-aab.mjs`, `scripts/audit-aab.mjs`) on purpose:
  bump gradle **and both** together, every upload, or the gates fail instead of
  letting a duplicate/old code through. A release whose bundle is not a strict
  upgrade over what is already on the track is what Play rejects with
  "doesn't allow any existing users to upgrade to the newly added app bundles".
- Gradle's `aaptOptions.ignoreAssetsPattern` contains a bare `.*`, which drops any
  asset whose name starts with a dot. That is why the `.well-known/` documents
  (`security.txt`, `assetlinks.json`) land in `android/app/src/main/assets/public`
  but not in the AAB. Harmless by design — both are fetched from the *domain*
  over HTTPS (Android's asset-links check reads
  `https://joining-palms.app/.well-known/assetlinks.json`, never an in-app copy;
  the app itself is served from the Capacitor origin) — but it is silent, so
  `verify:aab` names them as known exclusions and will fail on any third one.
- The release keystore is the one unrecoverable asset: if it is lost, Play rejects
  every future update of the listing. Back it up in two places, and keep the
  password in a password manager — not only on the machine that built it.
- Prayer audio (~112 MB) is bundled in the APK for offline use and is also pushed to
  the CDN. The 9 Gurmukhi Sikh mantras have no free neural voice and use on-device
  TTS by design.
