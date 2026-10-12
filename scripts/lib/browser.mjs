// Finding a browser, on whatever machine this happens to be running on.
//
// The browser tests used to hardcode two Windows paths and throw if neither
// existed. That was fine on the machine that wrote them and fatal on the CI
// runner (ubuntu-latest), where the `test` job installs no browser at all - so
// the four browser tests had never actually run in CI. They were hidden behind
// an earlier failure and nobody saw them fail until that was fixed.
//
// Order of preference:
//   1. CHROME_PATH, if the caller set one.
//   2. A system Chrome/Edge, which is what we want on a dev machine.
//   3. Playwright's own downloaded Chromium, which is what CI has.
//
// Passing undefined back to Playwright is the documented way to say "use your
// own browser", so the caller does not need to care which one it got.
import { existsSync } from 'node:fs'

const SYSTEM_CHROME = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
]

export function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  return SYSTEM_CHROME.find((p) => existsSync(p)) || undefined
}

// Software rendering, so a headless CI box with no GPU still produces a real
// WebGL context. Without this the Earth tests report "WebGL unavailable" and
// skip themselves, which is a green run that checked nothing.
export function launchOptions(chrome, extraArgs = []) {
  return {
    executablePath: chrome,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      ...extraArgs
    ]
  }
}

// Fail with something actionable rather than deep inside Playwright.
export async function requirePlaywright() {
  try {
    return await import('playwright')
  } catch {
    throw new Error(
      'playwright is not installed - run `npm install --legacy-peer-deps`'
    )
  }
}