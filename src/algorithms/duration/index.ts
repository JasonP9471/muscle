import { DURATION_ASSUMPTIONS } from '../../config/training'
import type { PlannedExercise } from '../../types'

export interface DurationOptions {
  warmup?: boolean
  cooldown?: boolean
  cardioMinutes?: number
}

export function calculateWorkoutDuration(exercises: PlannedExercise[], options: DurationOptions = {}): number {
  if (exercises.length === 0) return 0
  const setSeconds = exercises.reduce((total, exercise) => total + exercise.sets.reduce(
    (setTotal, set) => setTotal + DURATION_ASSUMPTIONS.secondsPerWorkingSet + set.restSeconds,
    0,
  ), 0)
  const transitions = Math.max(0, exercises.length - 1) * DURATION_ASSUMPTIONS.secondsPerTransition
  const setup = exercises.length * DURATION_ASSUMPTIONS.setupSecondsPerExercise
  const extras = (options.warmup ? DURATION_ASSUMPTIONS.warmupMinutes : 0)
    + (options.cooldown ? DURATION_ASSUMPTIONS.cooldownMinutes : 0)
    + (options.cardioMinutes ?? 0)
  return Math.max(1, Math.round((setSeconds + transitions + setup) / 60 + extras))
}

