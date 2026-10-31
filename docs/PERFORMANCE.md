# Performance — prayer-earth

How the Joining Palms app stays fast on phones and desktop. This documents
*what* is optimized and *why*; it is not a security document (see
`sync-engine/docs/SECURITY.md` for that).

## Bundle & loading

The single biggest lever is **code-splitting**. The app ships almost nothing
until it is actually needed:

| What loads | When |
|---|---|
| App shell + React + metadata | immediately |
| Per-tradition prayer texts (3–24 KB × 15) | when that tradition is opened |
| Prayer view, Earth view, Legal page | on navigation |
| Settings, onboarding, prayer picker, keyboard help, toast | on interaction |
| Speech engine (~27 KB) | on first play |
| three.js (~471 KB) | on first Earth/prayer interaction |

Result: the entry bundle went from ~448 KB to ~165 KB over the life of the
project. hashed assets are served with `immutable` cache headers, so repeat
visits (and the service worker) skip re-downloading unchanged code entirely.

## Rendering (React)

- The Zustand store's high-frequency setters (live prayer/spirit counts,
  lights) use **shallow-equality guards** — a presence tick that carries
  unchanged data notifies *zero* subscribers, so nothing re-renders.
- Hot, always-mounted components (Nav, WorldFeed, picker rows) are wrapped in
  `React.memo`.
- Components subscribe to the specific value they need (e.g. one prayer's
  count) rather than a whole object that changes on every update.
- Derived lists are memoized; keyboard listeners are attached once, not on
  every slider drag.

## WebGL / Earth

- The scene is fully **disposed** on unmount (geometries, materials, textures,
  context) — repeated navigation no longer leaks GPU memory.
- Prayer-light positions are **precomputed once**; the per-frame loop no longer
  recomputes 256 world matrices.
- Rendering is driven by the scene's own `requestAnimationFrame` loop — no
  React force-re-render intervals.
- The land/ocean boundary is a **dedicated mask texture** loaded once (not
  per-pixel RGB classification at runtime), and its light-snap grid is cached
  at module scope so the flood-fill runs a single time.

## Slower devices

- **Low-power detection** (`hardwareConcurrency` ≤ 4): fewer sphere segments,
  antialiasing off, capped pixel ratio, fewer particles and motes.
- **`prefers-reduced-motion` is handled separately** — users who ask for less
  motion get a still globe with *full* visual quality (resolution is not
  degraded for them, which was an earlier mistake).
- **Half-res assets**: the prayer-view backdrop uses a ~70 KB texture instead
  of the full ~180 KB map; the mask is pre-generated offline.
- **Graceful degradation everywhere**: WebGL failure shows a calm fallback
  screen; no speech voice falls back to a soft chant; no precise location
  falls back to a coarse timezone anchor; storage/quota errors are swallowed
  so state never crashes.

## Caching

- `/assets/*` (content-hashed) → `immutable`, one-year cache.
- `/audio/*` → cached 30 days (regenerated in place; CDN purged on update).
- Service worker → offline and instant repeat loads.

## Android Baseline Profile

The app ships `androidx.profileinstaller` and a `<profileable android:shell="true">`
tag (see `android/app/src/main/AndroidManifest.xml`), and the repo has a
macrobenchmark module at `android/benchmark/` whose only job is to *record*
which classes and methods the cold-start path actually touches. Play installs
that recorded profile on users' devices and ART ahead-of-time compiles those
paths — typically 10–30% faster cold start, most visible on low-end phones.

Pieces, and what each one is worth if removed:

- `android/benchmark/` (`com.android.test` module) — compiles standalone
  (`:benchmark:assembleRelease`), runs only against a **connected device**, and
  is never referenced by CI, the web build, or `bundleRelease`. Deleting it
  cannot break anything else.
- `androidx.profileinstaller` in `app/build.gradle` — inert no-op until a
  profile file exists; it is the runtime half that installs profiles.
- `<profileable android:shell="true">` in the manifest — lets the macrobenchmark
  trace the **release** build (which is not debuggable). Shell-only: no
  interactive access, and it is how Play's own profiling of production
  installs works.

### Recording the profile (needs a device)

There is no generated profile committed yet — generation needs a physical
Android device (the machine has no emulator system image). When a phone is
plugged in over USB with USB debugging on:

```powershell
# 1. web app must be fresh + synced (the release build refuses otherwise)
npm run build:release
npx cap sync android

# 2. record the profile (drives the app's release build on the device;
#    the rule stops once the recorded paths are stable, ~15 min max)
cd android
.\gradlew.bat :benchmark:connectedReleaseAndroidTest --console=plain
cd ..

# 3. the rule emits the profile under the benchmark module's outputs;
#    copy it where AGP packs it into the bundle
Copy-Item android\benchmark\build\outputs\connected_android_test_additional_output\**\baseline-prof.txt `
          android\app\src\main\baseline-prof.txt
```

Then rebuild the AAB (`npm run build:release && npx cap sync android &&
gradlew -p android bundleRelease`) — `mergeReleaseArtProfile` packs
`src/main/baseline-prof.txt` into the bundle automatically — and commit the
`baseline-prof.txt` so every future build ships it. Re-record whenever the
startup path changes substantially (new navigation, new heavy chunk on launch).

The generator test is deliberately **Java**
(`android/benchmark/src/main/java/.../BaselineProfile.java`): the repo has no
Kotlin plugin, and adding one to the whole build for a single test file would
put the release build at risk for no benefit. The benchmark API's
`@JvmOverloads` does not help here (the trailing `profileBlock` has no
default), so the Java call passes all arguments explicitly — if the library's
`collect()` signature ever changes, that file is where it will fail to compile,
and `:benchmark:assembleRelease` is the cheap device-free check for it.

## Regenerating the land mask

The Earth's coastline mask is `public/land-mask.png`:

```bash
node scripts/generate-land-mask.mjs                    # from the day texture
node scripts/generate-land-mask.mjs --source mask.png  # from your own raster
```

For pixel-perfect coastlines, generate from authoritative data (e.g. Natural
Earth land polygons) via `--source`.
