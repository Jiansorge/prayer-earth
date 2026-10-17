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
Then verify the artifact itself before uploading:
```bash
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
- `versionCode 28` / `versionName 1.0.0` in `android/app/build.gradle` — bump the
  code for every Play upload (it must strictly increase). `verify:aab` asserts 28
  against a **hardcoded** expectation; it cannot read the console, so confirm the
  real figure there before uploading.
- Gradle's `aaptOptions.ignoreAssetsPattern` contains a bare `.*`, which drops any
  asset whose name starts with a dot. That is why `.well-known/security.txt` is in
  `android/app/src/main/assets/public` but not in the AAB. Harmless today — the
  Android app is served from the Capacitor origin, and the web deploy publishes
  the copy that matters — but it is silent, so `verify:aab` names it as a known
  exclusion and will fail on any second one.
- The release keystore is the one unrecoverable asset: if it is lost, Play rejects
  every future update of the listing. Back it up in two places, and keep the
  password in a password manager — not only on the machine that built it.
- Prayer audio (~112 MB) is bundled in the APK for offline use and is also pushed to
  the CDN. The 9 Gurmukhi Sikh mantras have no free neural voice and use on-device
  TTS by design.
