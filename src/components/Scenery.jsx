import React, { useEffect, useState } from 'react'

// Pick a scenic "time of day" from the clock so the app breathes with the
// world: night, dawn, day, golden hour, dusk.
export function getScene() {
  const h = new Date().getHours()
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 16) return 'day'
  if (h >= 16 && h < 18) return 'golden'
  if (h >= 18 && h < 21) return 'dusk'
  return 'night'
}

// A wide row of pine silhouettes across the bottom of the view.
const PINES = Array.from({ length: 26 }, (_, i) => ({
  x: Math.round(i * 57 + ((i * 37) % 40)),
  w: 30 + ((i * 53) % 26),
  h: 46 + ((i * 31) % 40)
}))

export default function Scenery() {
  const [scene, setScene] = useState(getScene())
  useEffect(() => {
    const t = setInterval(() => setScene(getScene()), 60000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="scenery" data-scene={scene} aria-hidden="true">
      <div className="orb" />
      <svg className="hills" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path d="M0,250 C140,140 320,120 500,170 C680,220 820,110 1000,140 C1160,170 1300,70 1440,120 L1440,320 L0,320 Z" />
        <path d="M0,290 C180,210 360,190 560,235 C760,280 940,170 1140,210 C1290,240 1380,200 1440,220 L1440,320 L0,320 Z" />
      </svg>
      <svg className="trees" viewBox="0 0 1440 140" preserveAspectRatio="none">
        {PINES.map((p, i) => (
          <polygon
            key={i}
            points={`${p.x},140 ${p.x + p.w},140 ${p.x + p.w / 2},${140 - p.h}`}
          />
        ))}
      </svg>
    </div>
  )
}
