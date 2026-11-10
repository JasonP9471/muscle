import type { LucideIcon } from 'lucide-react'
import { Dumbbell, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Loading your training data…' }: { label?: string }) {
  return <div className="state-card loading-state" role="status"><LoaderCircle className="spin" /><span>{label}</span></div>
}

export function EmptyState({
  icon: Icon = Dumbbell,
  title,
  message,
  action,
}: {
  icon?: LucideIcon
  title: string
  message: string
  action?: React.ReactNode
}) {
  return <div className="state-card"><span className="state-icon"><Icon /></span><h2>{title}</h2><p>{message}</p>{action}</div>
}

