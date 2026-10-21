import { useT } from '../i18n.js'

// Shared chrome for a sub-panel: the title, and a Back control that returns to
// the main list.
export default function PanelShell({ title, onBack, children, testId }) {
  const t = useT()
  return (
    <div className="settings-panel" data-testid={testId}>
      <div className="settings-panel-head">
        <button type="button" className="settings-back" onClick={onBack}>
          ‹ {t('settings.back')}
        </button>
        <div className="settings-panel-title">{title}</div>
      </div>
      {children}
    </div>
  )
}
