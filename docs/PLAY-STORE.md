# Publishing Joining Palms to Google Play

Everything the repo can do is already done (permissions, signing config,
icons/splash, hosted legal pages). This is the remaining human/console work
and the exact commands.

## App identity

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| applicationId / package name | `app.joiningpalms`        |
| App name     | Joining Palms                           |
| Version      | `android/app/build.gradle` (`versionCode` / `versionName`) |
| Min / target | minSdk 24, compileSdk/targetSdk 36      |
| Backend      | `wss://joining-palms.app` (set in `.env.capacitor`) |

Target API 36 satisfies the Play target-API-level policy for 2025–2026.

## 1. Build toolchain (not installed on this machine yet)

The repo has **no Android SDK** and only **JDK 8**. AGP 8.13 + compileSdk 36
need **JDK 17+**. Install one of:

- **Android Studio** (bundles the SDK + JDK 17) — easiest, gives you a device
  emulator and the Play Console device check too, or
- Command line: JDK 17 (Temurin/Adoptium) + `sdkmanager` with
  `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`.

Then set `JAVA_HOME` and `ANDROID_HOME`, and make sure `android/local.properties`
points at the SDK (`sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`).

## 2. Build a release bundle (AAB)

```powershell
cd prayer-earth
npm install --legacy-peer-deps        # only if node_modules is stale
npm run cap:sync                       # build web (legal pages + icon gen baked in) → cap sync
cd android
.\gradlew.bat bundleRelease            # Windows;  ./gradlew bundleRelease on macOS/Linux
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Signing is wired in `android/app/build.gradle` and reads
`android/key.properties` (gitignored). If that file is missing, the release
build is simply unsigned — fine for CI, but Play needs it signed.

### The upload key (already generated)

- Keystore: `C:\Users\j\.android\joining-palms\upload-keystore.jks` (**outside
  the repo on purpose** — the repo is public)
- Passwords/alias: `android/key.properties` (gitignored)
- Alias: `joining-palms-upload`

**Back both files up somewhere safe.** With Play App Signing, this is only the
*upload* key — if you lose it you can request a reset — but losing it is still a
headache. Never commit either file; the repo is public.

## 3. Play Console setup (manual, one time)

1. Create a **personal** developer account at
   <https://play.google.com/console> — one-time **US$25**.
2. Provide contact name, **physical address**, email, phone; verify email +
   phone by OTP, then verify identity with a government ID (name + address must
   match the payments profile).
3. Verify a real, non-rooted **Android 10+ device** via the Play Console mobile
   app (required for new personal accounts).
4. Create the app, upload the AAB to a **closed testing** track (internal
   testing does not count toward the requirement below).

### Your address is not public

For a **personal** account with a **free app and no in-app purchases**, Play
shows only your **developer name**, **country**, and **developer email** on the
store listing. Your full street address and phone number are used for identity
verification but are **not shown**. They only become public if you later sell
the app or add IAP. Use a dedicated developer email (e.g.
`care@joining-palms.app`), not your personal Gmail.

A **PO box will not pass verification** — the address must match your
government ID — so it isn't needed and wouldn't work as the primary address.

## 4. Closed testing requirement (12 testers, 14 days)

New **personal** accounts created on/after 2023-11-13 must run a closed test
with **at least 12 testers opted in continuously for 14 days** before they can
apply for production access. (This was 20 when introduced; Google lowered it to
**12 in December 2024** — ignore older "20 testers" guides.)

How Google verifies it:

- You add testers by **email address** or a **Google Group**, share the *opt-in
  link*, and each tester taps **Become a tester** *while signed into the exact
  account you listed*, then installs the app from Play.
- Google tracks how long each tester stays **opted in** (and normally installed).
  A tester who opts out / uninstalls **resets their own clock**.
- Play Console's closed-testing page shows the qualifying tester count. Once
  **≥12 have been continuously opted in for 14 days**, you can **apply for
  production access** and Google reviews the request.
- **Internal testing does not count.** Emulators generally don't count — use
  real devices. Do not buy/fake testers; that violates policy and puts the
  account at risk. Recruit a small margin above 12 to absorb dropouts.

Your own device is **not** publicly visible: the device check is private, testers
only see the listing (name / email / country), and inside the app every prayer is
an anonymous made-up name plus a ~110 km grid cell — never a device identity or
precise location.

## 5. Store listing assets

Prepared in-repo:

- Launcher icons + adaptive icon + splash — generated from `assets/logo.svg`
  via `npx capacitor-assets generate --android ...` (regenerate after logo
  changes).
- 512×512 store icon: reuse `public/icons/icon-512.png`.
- Feature graphic (1024×500) and phone screenshots (min 2, ideally 4–8):
  `public/screenshot.png` / `public/demo.gif` are starting points; capture real
  device screenshots for the listing.

Listing copy:
- **Short description** (≤80 chars): "Pray together with the whole world."
- **Full description**: pull from `README.md` / `index.html` meta description.
- Category: Lifestyle (or Books & Reference). Tags: meditation, prayer, wellness.
- Contact email: `care@joining-palms.app`.

## 6. Policy forms (answers based on what the app actually does)

**Privacy policy URL:** `https://joining-palms.app/privacy.html`
(terms: `https://joining-palms.app/terms.html`) — generated at build time from
the same strings the app renders, so they can't drift. In-app deep links remain
`#/privacy` and `#/terms`.

**Data safety** (be honest; here's what's true):

| Question | Answer |
| --- | --- |
| Does your app collect or share required user data types? | **Yes** — Approximate location (collected, and shared only as a coarse grid cell in the shared world). |
| Is all of the user data encrypted in transit? | **Yes** (HTTPS/WSS). |
| Do you provide a way for users to request data deletion? | **Yes** — most data is device-only (clear storage); contact email for the rest. |
| Account / personal info / financial info | Not collected. No login, no ads, no trackers. |
| Precise location | **Not collected** (rounded to 1 decimal + ~110 km grid). |
| App functionality / diagnostics | No analytics SDK. Crash/usage data as described in the policy. |
| Is data shared with third parties? | Only the hosting/CDN provider (Cloudflare) for delivery. |

Declare **approximate location** and explain it powers the shared Earth map; do
**not** declare precise location.

**Content rating:** complete the questionnaire (Lifestyle/Utility). Expect a
low rating; there is religious/meditative content from many traditions but no
violence, sexuality, profanity, gambling, or user-generated chat.

**Ads:** "app does not contain ads". **In-app purchases:** "no" (the Ko-fi
donation is an external link, not IAP).

## 7. Release checklist

- [ ] JDK 17 + Android SDK installed, `local.properties` set
- [ ] `npm run cap:sync` succeeds; test on a real device (geolocation prompt now
      appears and the "you are here" ring works)
- [ ] Bump `versionCode` (integer, always increments) and `versionName` before
      every upload
- [ ] `gradlew bundleRelease` produces a signed `app-release.aab`
- [ ] Closed test created, ≥12 testers opted in, 14 days elapsed
- [ ] Apply for production access; address review feedback
- [ ] Upload listing assets + fill Data safety, content rating, store settings
- [ ] Roll out (staged: 20% → 50% → 100%)

## Regenerating native assets after changes

```powershell
# After editing assets/logo.svg or the location permission set:
npx capacitor-assets generate --android `
  --iconBackgroundColor '#07150d' --iconBackgroundColorDark '#060313' `
  --splashBackgroundColor '#07150d' --splashBackgroundColorDark '#060313'
npm run cap:sync
```

## iOS (later)

`ios/App` exists. Apple requires its own paid developer account (US$99/yr),
a Mac/Xcode build, an App Store Connect listing, and its own privacy "nutrition
label". `ios/App/Info.plist` will also need `NSLocationWhenInUseUsageDescription`
for geolocation. Reuse the same legal URLs.
