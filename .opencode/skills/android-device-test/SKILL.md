---
name: Android Device Test
description: Verify Joining Palms on a physical Android device - install a fresh debug APK and measure on-screen glyph ink offsets in the real WebView via adb + Chrome DevTools Protocol. Use when validating CSS or control-glyph changes on-device, after touching src/styles.css buttons, when the user says the phone is plugged in or asks about Android rendering, or when an APK rebuild/install chain is needed.
---

# Android device test

Two jobs, both against the **real app in the real WebView** (CI's emulator is not a substitute for font/rendering fidelity):

1. Rebuild + install the debug APK so the phone runs the current bundle.
2. Probe every visible control button's ink offset with the same TextMetrics math the CI centering gate uses, plus font-load status.

## Prerequisites

- Phone plugged in over USB, USB debugging enabled (device shows in `adb devices`).
- Run everything from the **prayer-earth repo root**.
- `adb` is **not** on this machine's PATH; the probe script autodetects it at
  `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (and the macOS/Linux SDK locations). Override with env `ADB`.

## 1. Rebuild and install the APK

After any change to `src/` (JS **or** CSS), the phone runs a stale bundle until you reinstall - the WebView loads assets out of the APK:

```powershell
# from prayer-earth root
npm run build
npm run cap:sync                      # copies dist/ into android/app/src/main/assets/public
cd android
.\gradlew.bat :app:assembleDebug --console=plain     # ~90s warm
cd ..
adb -s <SERIAL> install -r "<repo>\android\app\build\outputs\apk\debug\app-debug.apk"
adb -s <SERIAL> shell am force-stop app.joiningpalms
adb -s <SERIAL> shell am start -n app.joiningpalms/.MainActivity
```

`check:android:sync` fails CI if you forget `cap:sync` (packaged assets must match `dist/`). Debug build works on any device with USB debugging; release builds need the signing keystore (`npm run check:signing`).

## 2. Probe glyph centering on the device

```powershell
node scripts/centering-on-device.mjs
```

This forwards adb to the app's WebView DevTools socket (`webview_devtools_remote_<pid>`), waits for boot, awaits `document.fonts.load` + `fonts.ready` (Canvas2D silently measures the *system* font for an unloaded `@font-face` - this is load-bearing, the bundled symbol font must report `loaded`), then measures every in-viewport control button.

Output per row: `page  selector[glyph]  off=-0.5px  [ok|LOW|HIGH]`, then `WARN` lines for emoji rows, then `PASS`/`FAIL` + exit code.

**Acceptance:** every symbol-glyph row within `±THRESHOLD` px (default 1.5). Emoji avatar rows are **warn-only** (color emoji can't be bundled; Android draws 🔥 ~-2px vs Windows' text presentation - a documented, accepted exception).

Environment knobs: `SERIAL` (auto when exactly one device), `PKG` (default `app.joiningpalms`), `THRESHOLD` (default `1.5`), `RELAUNCH=1` (force-stop + cold start before probing), `NAV='#/pray/buddhism/mani'` (set location.hash and wait for a marker before measuring).

## Reference readings (Pixel 7, Oct 26 2026, bundled DejaVu Symbols font)

| control | pre-font | with font |
|---|---|---|
| back arrow `←` | **+2.8px** (Noto) | 0px |
| favourite `☆` / share `⇪` | ~+2.8 | -0.5 |
| chooser arrows `‹ ›` | ~+2.8 | -1.4 |
| play `▶︎` / stop `◼` | ~+2.8 | -1 / +0.9 |
| tune `⚙︎` | ~+2.8 | -1.5 |
| sheet-x `✕` | — | -0.3 |
| nav-play `▶︎` | — | +1.2 |
| 🔥 emoji avatar | -2.4 | -2 (accepted) |

Local Windows numbers run tighter (±0.5); device is the loosest of the three platforms.

## Known quirks and flakes

- **Cold dev server:** against fresh `npm start` vite, a hash navigation can hang - wait for `commit` rather than full load, and `window.__store` may not exist yet. The APK probe is unaffected (file-served bundle).
- **Boot gate:** wait for a real DOM marker (`.ctrl-btn.play`, `.home-title`), not a timer; `document.fonts.ready` alone does not mean the app mounted.
- **Settings sub-panels:** clicking `[data-testid="row-keys"]` did not open the panel via CDP on Oct 26, so `settings-back` stays unprobed on device (it measures on Windows + CI). A freshly opened settings sheet has **zero** `.settings-back` elements - don't read that as a failure.
- **Stale WebView:** if numbers look unchanged after a CSS edit, the APK wasn't reinstalled (step 1), not a measurement bug.
- **exit-13 / socket refused:** app not running or not in foreground - run step 1's relaunch, or set `RELAUNCH=1`.
- **PowerShell 5 on this box:** no `??` operator, no bash process substitution; keep commands plain.

## Cleanup

The script removes its `adb forward` listener on exit (even on failure paths). It never modifies app state beyond hash navigation; it does not install or uninstall anything.
