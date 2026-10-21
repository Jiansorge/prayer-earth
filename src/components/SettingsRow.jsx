import React from 'react'

// A row that opens a panel. A <button> rather than a div so it is reachable by
// keyboard and announced as activatable.
export function SettingsRow({ label, hint, onClick, testId, className = '' }) {
  return (
    <button
      type="button"
      className={`settings-row ${className}`.trim()}
      onClick={onClick}
      data-testid={testId}
    >
      <span className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {hint ? <span className="settings-row-hint">{hint}</span> : null}
      </span>
      <span className="settings-row-chevron" aria-hidden="true">›</span>
    </button>
  )
}
