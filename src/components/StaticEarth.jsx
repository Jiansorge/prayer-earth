import React, { useMemo } from 'react'
import { useStore } from '../store.js'

// The Earth for browsers and devices with no WebGL - which is every
// LibreWolf user, because it blocks WebGL by default, plus anything with four
// cores or fewer.
//
// The previous version was a blue sphere with three hard-coded ellipses: no
// coastlines, no atmosphere, and no prayer lights at all, so the one thing
// people come here to see was simply missing for those users.
//
// This rebuilds it from the same asset the WebGL path samples. The land mask is
// an equirectangular map (white = land), so it is laid out twice side by side
// and slid sideways, which reads as a rotating globe; the lights use the same
// lon/lat mapping and live inside that same sliding wrapper so they stay pinned
// to their coastlines instead of drifting.
//
// Rotation is decorative, so it stops for prefers-reduced-motion.

const SPIN_SECONDS = 90

// The globe has ~23,760 possible grid cells. The WebGL scene pools 256 sprites,
// so the fallback has to cap too: this path is chosen precisely for
// four-core-and-down devices, and rendering every occupied cell as an animated
// DOM node is the one thing guaranteed to stall them.
const MAX_DOTS = 256

// lon/lat -> percentage across the 2x-wide wrapper. Mirrors the spherical
// mapping in EarthScene.setLights: x = cos(lat)cos(lon), z = cos(lat)sin(lon),
// reduced to the equirectangular case for a flat strip.
const xForLon = (lon) => ((lon + 180) / 360) * 200
const yForLat = (lat) => ((90 - lat) / 180) * 100

export default function StaticEarth({ compact = false }) {
  const lights = useStore((s) => s.lights)
  const youLoc = useStore((s) => s.youLoc)

  const dots = useMemo(() => {
    const cells = []
    for (const [key, n] of Object.entries(lights || {})) {
      const c = key.indexOf(',')
      if (c < 0) continue
      const lat = parseFloat(key.slice(0, c))
      const lon = parseFloat(key.slice(c + 1))
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      cells.push({
        key,
        left: xForLon(lon),
        top: yForLat(lat),
        weight: Math.min(3, Math.max(1, n))
      })
    }
    // Keep the busiest cells when there are more than the cap, so the globe
    // still reads as inhabited rather than as an arbitrary sample.
    if (cells.length > MAX_DOTS) {
      cells.sort((a, b) => b.weight - a.weight)
      cells.length = MAX_DOTS
    }
    return cells
  }, [lights])

  return (
    <div
      className={`earth-fallback${compact ? ' earth-fallback-compact' : ''}`}
      role="img"
      aria-label="Earth"
    >
      <div className="efg">
        {/* Sliding map: two copies of the mask, so the seam never shows. */}
        <div
          className="efg-spin"
          style={{ animationDuration: `${SPIN_SECONDS}s` }}
        >
          <div className="efg-land" />
          <div className="efg-lights">
            {dots.map((d) => (
              <span
                key={d.key}
                className="efg-light"
                style={{
                  left: `${d.left}%`,
                  top: `${d.top}%`,
                  '--w': d.weight
                }}
              />
            ))}
            {youLoc && Number.isFinite(youLoc.lat) && (
              <span
                className="efg-light efg-light-you"
                style={{
                  left: `${xForLon(youLoc.lon)}%`,
                  top: `${yForLat(youLoc.lat)}%`
                }}
              />
            )}
          </div>
        </div>
        {/* Sphere shading and atmosphere sit above the spin and stay put. */}
        <div className="efg-shade" />
        <div className="efg-atmo" />
      </div>
    </div>
  )
}