import React from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

const dayKey = (t) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate()
  ).padStart(2, '0')}`

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const shortDay = (t) => WEEK[t.getDay()]

const fmtSecs = (s) => {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const W = 300
const H = 92
const PAD_B = 16
const PAD_T = 12

export default function PrayerStats({ prayerId }) {
  const stats = useStore((s) => s.prayerDayStats)
  const total = useStore((s) => s.getPrayerTotal(prayerId))
  const t = useT()

  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ key: dayKey(d), label: shortDay(d), full: d.toLocaleDateString() })
  }
  const values = days.map((d) => stats[d.key]?.[prayerId] || 0)
  const max = Math.max(4, ...values)
  const slot = W / 7
  const bw = slot - 8
  const usable = H - PAD_B - PAD_T

  return (
    <div className="prayer-stats fade-in">
      <div className="ps-top">
        <span className="ps-title">{t('stats.thisWeek')}</span>
        <span className="ps-total">
          ✶ {total.toLocaleString()} {t('stats.allTime')}
        </span>
      </div>
      <svg
        className="ps-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${t('stats.thisWeek')}, ${values.map((v, i) => `${days[i].label}: ${fmtSecs(v)}`).join(', ')}`}
      >
        {values.map((v, i) => {
          const h = Math.max(2, (v / max) * usable)
          return (
            <g key={days[i].key}>
              <title>{`${days[i].full} · ${fmtSecs(v)}`}</title>
              <rect
                x={i * slot + 4}
                y={PAD_T + (usable - h)}
                width={bw}
                height={h}
                rx={3}
                className="ps-bar"
              />
              <text
                x={i * slot + 4 + bw / 2}
                y={H - 4}
                textAnchor="middle"
                className="ps-lbl"
              >
                {days[i].label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="ps-foot">{t('stats.foot')}</div>
    </div>
  )
}
