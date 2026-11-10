import type { Units } from '../types'

export const PLATE_OPTIONS: Record<Units, readonly number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
}

export const DEFAULT_BAR_WEIGHT: Record<Units, number> = { lb: 45, kg: 20 }
export const QUICK_WEIGHT_STEP: Record<Units, number> = { lb: 5, kg: 2.5 }

export const WARMUP_STAGES = [
  { percentage: 0.4, reps: 8, restSeconds: 45 },
  { percentage: 0.6, reps: 5, restSeconds: 60 },
  { percentage: 0.75, reps: 3, restSeconds: 75 },
  { percentage: 0.85, reps: 1, restSeconds: 90 },
] as const
