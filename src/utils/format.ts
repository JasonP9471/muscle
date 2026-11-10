import type { Goal, Muscle, Units } from '../types'

export const formatMuscle = (muscle: Muscle | string) => muscle.replace(/\b\w/g, (char) => char.toUpperCase())
export const formatGoal = (goal: Goal) => goal.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
export const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
export const formatLongDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`
}
export const formatWeight = (value: number, units: Units) => `${Math.round(value).toLocaleString()} ${units}`
export const formatDate = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
export const formatRelativeDate = (iso?: string) => {
  if (!iso) return 'Not trained yet'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

