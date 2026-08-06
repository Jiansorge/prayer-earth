import React, { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n.js'

export default function QRCard({ spirit, prayer, onClose }) {
  const canvasRef = useRef(null)
  const t = useT()
  const [url] = useState(
    () => `${window.location.origin}/#/pray/${spirit.id}/${prayer.id}`
  )
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    const c = canvasRef.current
    // qrcode is only needed here, so load it lazily to keep the main bundle lean
    import('qrcode')
      .then(({ default: QRCode }) => {
        if (!alive) return
        QRCode.toCanvas(
          c,
          url,
          {
            margin: 2,
            width: 184,
            errorCorrectionLevel: 'M',
            color: { dark: '#0b1026', light: '#ffffff' }
          },
          (e) => {
            if (alive && e) setErr(true)
          }
        )
      })
      .catch(() => {
        if (alive) setErr(true)
      })
    return () => {
      alive = false
    }
  }, [url])

  const download = () => {
    const c = canvasRef.current
    if (!c) return
    const a = document.createElement('a')
    a.download = `${prayer.id}-prayer-card.png`
    a.href = c.toDataURL('image/png')
    a.click()
  }

  return (
    <div className="qr-backdrop" onClick={onClose}>
      <div className="qr-card" onClick={(e) => e.stopPropagation()}>
        <button className="qr-x" onClick={onClose} aria-label={t('prayer.close')}>
          ✕
        </button>
        <div className="qr-emoji">{spirit.emoji}</div>
        <div className="qr-title">{prayer.title}</div>
        <div className="qr-sub">
          {spirit.name} · {t('qr.prayWithWorld')}
        </div>
        <div className="qr-frame">
          {err ? (
            <div className="qr-err">{t('qr.err')}</div>
          ) : (
            <canvas ref={canvasRef} className="qr-canvas" />
          )}
        </div>
        <div className="qr-brand">Joining Palms · {t('qr.prayWithWorld')}</div>
        <div className="qr-url">{url}</div>
        <div className="qr-actions">
          <button className="qr-btn" onClick={download}>
            {t('qr.saveCard')}
          </button>
        </div>
      </div>
    </div>
  )
}
