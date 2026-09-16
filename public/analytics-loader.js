// Cloudflare Web Analytics — loaded from this same-origin file (the page CSP
// forbids inline scripts: script-src 'self' https://static.cloudflareinsights.com).
// The loader itself is 'self', and the beacon loads from the allow-listed CDN.
// Skipped under Lighthouse (auto-audit crawlers) so the beacon fetch doesn't
// surface as a console error during audits.
if (!/Chrome-Lighthouse|HeadlessChrome/i.test(navigator.userAgent)) {
  const s = document.createElement('script')
  s.type = 'module'
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  s.setAttribute('data-cf-beacon', '{"token": "8765c1887bb54b48928d93c3faa8e66c"}')
  document.head.appendChild(s)
}