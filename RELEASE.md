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
npm run build:capacitor && npx cap sync android
cd android && ./gradlew bundleRelease   # .aab for Play
```
Upload the `.aab` to the Play Console.

## Notes
- `versionCode 24` / `versionName 1.0.1` in `android/app/build.gradle` — bump the
  code for every Play upload (it must strictly increase).
- Prayer audio (~112 MB) is bundled in the APK for offline use and is also pushed to
  the CDN. The 9 Gurmukhi Sikh mantras have no free neural voice and use on-device
  TTS by design.
