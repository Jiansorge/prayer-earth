// Test-observability hooks (window.__store / __speech / __ambient) are exposed
// ONLY when explicitly enabled at build time, never via a runtime query param.
//
// Why this is gated: these objects are a full read/write handle on app state
// (counters, profile, the audio engines). A previous version exposed the store
// whenever the URL had ?peTest=1, which SHIPPED in the production web bundle and
// was reachable by anyone who got a user to open a crafted link — a real remote
// hole. Test hooks must never be reachable in a deployed build.
//
// - Vite dev server (import.meta.env.DEV): always on, for the browser test suite.
// - VITE_TEST_HOOKS=true at build time: on for instrumented Android/Capacitor
//   builds used by the on-device smoke test. The .env.capacitor file sets it; the
//   PUBLIC Play release should build WITHOUT it (see RELEASE.md).
// `import.meta.env` is undefined outside Vite, so this is optional-chained.
// Plain Node imports the audio modules for unit tests, and an unguarded
// `import.meta.env.DEV` threw there - which meant the bed gain arithmetic could
// only be tested by scraping ambience.js as text, since importing the real
// module crashed. Optional chaining keeps the gate exactly as strict in a build
// (where import.meta.env always exists) while letting Node load the module.
export const TEST_HOOKS =
  import.meta.env?.DEV === true || import.meta.env?.VITE_TEST_HOOKS === 'true'
