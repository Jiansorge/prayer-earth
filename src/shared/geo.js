// Pure, shared logic used by both the browser client and the Node server.
// Nothing here may import from the app or touch the DOM / Node APIs.

// Rounds a coordinate onto the shared 1-degree light grid the app renders, so
// nearby prayers land on the same cell and become one brighter light. One
// degree is ~110km, precise enough to feel real, coarse enough to stay
// anonymous: no exact position ever leaves the device.
export function gridKey(lat, lon) {
  const la = Math.max(-60, Math.min(72, Math.round(lat)))
  let lo = Math.round(lon)
  if (lo >= 180) lo = -180
  return `${la},${lo}`
}
