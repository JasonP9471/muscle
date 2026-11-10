import { Activity } from 'lucide-react'
import { BRAND } from '../config/brand'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label={BRAND.name} title={BRAND.subtitle}>
      <span className="brand-icon" aria-hidden="true"><Activity size={compact ? 19 : 22} /></span>
      {!compact && <strong>{BRAND.name.slice(0, -2).toUpperCase()}<span>{BRAND.name.slice(-2).toUpperCase()}</span></strong>}
    </div>
  )
}
