export function calculateEstimatedOneRepMax(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0 || reps > 15) return null
  return Math.round((weight * (1 + reps / 30)) * 10) / 10
}

export function calculateVolume(sets: Array<{ weight: number; reps: number }>): number {
  return Math.round(sets.reduce((total, set) => total + Math.max(0, set.weight) * Math.max(0, set.reps), 0) * 10) / 10
}

