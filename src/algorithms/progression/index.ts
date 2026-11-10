import { PROGRESSION } from '../../config/training'
import type { Exercise, Units } from '../../types'

export interface ProgressionSet {
  weight: number
  reps: number
  rir: number
}

export interface PrescriptionInput {
  exercise: Exercise
  previousSets: ProgressionSet[]
  targetRepRange: [number, number]
  units: Units
  recentPerformances?: ProgressionSet[][]
}

export interface NextPrescription {
  weight?: number
  targetReps: number
  action: 'first_session' | 'increase_weight' | 'increase_reps' | 'maintain' | 'reduce_weight'
  reason: string
}

const roundToIncrement = (value: number, increment: number) => Math.round(value / increment) * increment

export function recommendWeight(
  exercise: Exercise,
  currentWeight: number,
  direction: 'increase' | 'reduce',
  units: Units,
): number {
  const isLower = exercise.primaryMuscles.some(({ muscle }) => ['quadriceps', 'hamstrings', 'glutes'].includes(muscle))
  const requestedPercent = direction === 'increase'
    ? (isLower ? PROGRESSION.lowerBodyPercent : PROGRESSION.upperBodyPercent)
    : -PROGRESSION.reductionPercent
  const increment = units === 'kg'
    ? (exercise.requiredEquipment.some((item) => item.includes('dumbbell')) ? PROGRESSION.dumbbellIncrementKg : PROGRESSION.defaultIncrementKg)
    : (exercise.requiredEquipment.some((item) => item.includes('dumbbell')) ? PROGRESSION.dumbbellIncrementLb : PROGRESSION.defaultIncrementLb)
  const raw = currentWeight * (1 + requestedPercent)
  const rounded = roundToIncrement(raw, increment)
  const maxIncrease = currentWeight * (1 + PROGRESSION.maxIncreasePercent)
  return Math.max(0, direction === 'increase' ? Math.min(rounded, roundToIncrement(maxIncrease, increment)) : rounded)
}

export function recommendReps(previousSets: ProgressionSet[], targetRepRange: [number, number]): number {
  if (previousSets.length === 0) return targetRepRange[0]
  const minimum = Math.min(...previousSets.map((set) => set.reps))
  return Math.min(targetRepRange[1], Math.max(targetRepRange[0], minimum + 1))
}

export function detectPlateau(recentPerformances: ProgressionSet[][] = []): boolean {
  if (recentPerformances.length < PROGRESSION.plateauSessions) return false
  const recent = recentPerformances.slice(0, PROGRESSION.plateauSessions)
  const scores = recent.map((sets) => sets.reduce((total, set) => total + set.weight * set.reps, 0))
  const best = Math.max(...scores)
  const worst = Math.min(...scores)
  return best > 0 && (best - worst) / best < 0.015
}

export function calculateNextPrescription(input: PrescriptionInput): NextPrescription {
  const { exercise, previousSets, targetRepRange, units } = input
  if (previousSets.length === 0) {
    return { targetReps: targetRepRange[0], action: 'first_session', reason: 'Start with a controlled load and leave about 2–3 reps in reserve.' }
  }
  const working = previousSets.filter((set) => set.reps > 0)
  const weight = working[0]?.weight ?? 0
  const reachedTop = working.every((set) => set.reps >= targetRepRange[1] && set.rir >= 1)
  const missedBottom = working.filter((set) => set.reps < targetRepRange[0]).length >= Math.ceil(working.length / 2)
  if (missedBottom) {
    return { weight: recommendWeight(exercise, weight, 'reduce', units), targetReps: targetRepRange[0], action: 'reduce_weight', reason: 'The recent load fell below the target range across multiple sets, so a modest reduction should restore quality reps.' }
  }
  if (reachedTop && weight > 0) {
    const nextWeight = recommendWeight(exercise, weight, 'increase', units)
    if (nextWeight > weight) return { weight: nextWeight, targetReps: targetRepRange[0], action: 'increase_weight', reason: 'All working sets reached the top of the range with reps in reserve.' }
  }
  if (working.some((set) => set.reps < targetRepRange[1])) {
    return { weight, targetReps: recommendReps(working, targetRepRange), action: 'increase_reps', reason: 'Keep the load and aim for one more controlled rep before adding weight.' }
  }
  return { weight, targetReps: targetRepRange[0], action: 'maintain', reason: 'Repeat this load and consolidate performance before progressing.' }
}

