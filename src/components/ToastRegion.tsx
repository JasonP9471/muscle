import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'

export function ToastRegion() {
  const { toasts, removeToast } = useUIStore()
  return (
    <div className="toast-region" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info
        return <div className={`toast ${toast.tone}`} key={toast.id}><Icon size={19} /><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => removeToast(toast.id)}><X size={17} /></button></div>
      })}
    </div>
  )
}

