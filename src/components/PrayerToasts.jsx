// The two fixed status pills that float over the prayer view: another
// practitioner joined your prayer, or a reflection on your own count today.
// Both are pure status and share one styling so the pair reads as one family.
import React from 'react'
import { useT } from '../i18n.js'

const momentToastStyle = {
  position: 'fixed',
  bottom: 84,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 55,
  padding: '9px 16px',
  borderRadius: 999,
  background: 'rgba(11, 16, 38, 0.92)',
  color: '#e8e6df',
  fontFamily: 'var(--sans)',
  fontSize: 13,
  boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
  pointerEvents: 'none'
}

export default function PrayerToasts({ joinedToast, prayerCount, reflection, prayerToday }) {
  const t = useT()
  return (
    <>
    {joinedToast && (
      <div
        className="joined-moment join-pulse"
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 84,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 55,
          padding: '9px 16px',
          borderRadius: 999,
          background: 'rgba(11, 16, 38, 0.92)',
          color: '#e8e6df',
          fontFamily: 'var(--sans)',
          fontSize: 13,
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          pointerEvents: 'none'
        }}
       >
         {t('prayer.joinedYou', { n: prayerCount })}
       </div>
     )}
     {reflection !== null && (
       <div
         className="joined-moment join-pulse"
         role="status"
         aria-live="polite"
         style={{
           position: 'fixed',
           bottom: 84,
           left: '50%',
           transform: 'translateX(-50%)',
           zIndex: 55,
           padding: '9px 16px',
           borderRadius: 999,
           background: 'rgba(11, 16, 38, 0.92)',
           color: '#e8e6df',
           fontFamily: 'var(--sans)',
           fontSize: 13,
           boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
           pointerEvents: 'none'
         }}
       >
          ✶ {reflection} {t('prayer.today', { n: prayerToday.toLocaleString() })} — your prayer is carried.
       </div>
     )}
    </>
  )
}
