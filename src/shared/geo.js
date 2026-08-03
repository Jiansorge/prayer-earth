// Pure, shared logic used by both the browser client and the Node server.
// Nothing here may import from the app or touch the DOM / Node APIs.

// Rounds a coordinate onto the shared 2-degree light grid the app renders, so
// nearby prayers land on the same cell and become one brighter light.
export function gridKey(lat, lon) {
  const la = Math.max(-60, Math.min(72, Math.round(lat / 2) * 2))
  let lo = Math.round(lon / 2) * 2
  if (lo >= 180) lo = -180
  return `${la},${lo}`
}
