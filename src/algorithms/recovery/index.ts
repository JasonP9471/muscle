import { EFFORT_FACTORS, FATIGUE } from '../../config/training'
import { MUSCLES } from '../../types'
import type { Exercise, ExperienceLevel, FatigueSource, Muscle, MuscleState, RecoveryAggressiveness } from '../../types'

export interface FatigueSetInput {
  reps: number
  weight?: number
  rir: number
}

export interface WorkoutFatigueExercise {
  exercise: Exercise
  sets: FatigueSetInput[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function calculateSetFatigue(
  exercise: Exercise,
  set: FatigueSetInput,
  experience: ExperienceLevel = 'intermediate',
): Partial<Record<Muscle, number>> {
  const effort = EFFORT_FACTORS[Math.min(5, Math.max(0, Math.round(set.rir)))] ?? EFFORT_FACTORS[5]
  const repetitionFactor = clamp(set.reps / 10, 0.62, 1.38)
  const loadFactor = exercise.exerciseType === 'weighted' && (set.weight ?? 0) > 0
    ? clamp(0.88 + Math.log10((set.weight ?? 0) + 1) * 0.075, 0.9, 1.15)
    : 1
  const exerciseFactor = exercise.compound ? FATIGUE.compoundMultiplier : FATIGUE.isolationMultiplier
  const experienceFactor = FATIGUE.experienceMultiplier[experience]
  const baseCost = FATIGUE.baseSetCost * effort * repetitionFactor * loadFactor * exerciseFactor * experienceFactor
  const result: Partial<Record<Muscle, number>> = {}

  for (const contribution of exercise.primaryMuscles) {
    result[contribution.muscle] = baseCost * contribution.contribution * FATIGUE.primaryMultiplier
  }
  for (const contribution of exercise.secondaryMuscles) {
    result[contribution.muscle] = (result[contribution.muscle] ?? 0)
      + baseCost * contribution.contribution * FATIGUE.secondaryMultiplier
  }
  return result
}

export function calculateWorkoutFatigue(
  exercises: WorkoutFatigueExercise[],
  experience: ExperienceLevel = 'intermediate',
): Partial<Record<Muscle, number>> {
  const total: Partial<Record<Muscle, number>> = {}
  for (const entry of exercises) {
    for (const set of entry.sets) {
      const setFatigue = calculateSetFatigue(entry.exercise, set, experience)
      for (const [muscle, cost] of Object.entries(setFatigue) as [Muscle, number][]) {
        total[muscle] = Math.min(FATIGUE.maxWorkoutFatigue, (total[muscle] ?? 0) + cost)
      }
    }
  }
  return total
}

export const calculateMuscleFatigue = calculateWorkoutFatigue

export function recoveryWindowForFatigue(fatigue: number): number {
  if (fatigue <= 18) return FATIGUE.minimumRecoveryWindowHours
  if (fatigue >= 70) return FATIGUE.maximumRecoveryWindowHours
  const normalized = (fatigue - 18) / 52
  return Math.round(FATIGUE.minimumRecoveryWindowHours
    + normalized * (FATIGUE.maximumRecoveryWindowHours - FATIGUE.minimumRecoveryWindowHours))
}

export function calculateRecoveryPercentage(
  postWorkoutRecovery: number,
  elapsedHours: number,
  recoveryWindowHours: number,
  aggressiveness: RecoveryAggressiveness = 'balanced',
): number {
  if (postWorkoutRecovery >= 100) return 100
  const adjustedElapsed = elapsedHours * FATIGUE.aggressivenessRate[aggressiveness]
  const recovered = postWorkoutRecovery + (100 - postWorkoutRecovery) * (adjustedElapsed / recoveryWindowHours)
  return Math.round(clamp(recovered, postWorkoutRecovery, 100))
}

export function getMuscleRecovery(
  state: MuscleState,
  now: Date = new Date(),
  aggressiveness: RecoveryAggressiveness = 'balanced',
): number {
  const elapsedHours = Math.max(0, (now.getTime() - new Date(state.lastUpdatedAt).getTime()) / 3_600_000)
  return clamp(
    calculateRecoveryPercentage(state.recovery, elapsedHours, state.recoveryWindowHours, aggressiveness)
      + state.manualAdjustment,
    0,
    100,
  )
}

export function createFreshMuscleStates(now = new Date()): MuscleState[] {
  return MUSCLES.map((muscle) => ({
    muscle,
    recovery: 100,
    lastUpdatedAt: now.toISOString(),
    recoveryWindowHours: FATIGUE.normalRecoveryWindowHours,
    sources: [],
    manualAdjustment: 0,
  }))
}

export function updateRecoveryStates(
  states: MuscleState[],
  workoutFatigue: Partial<Record<Muscle, number>> = {},
  sources: Partial<Record<Muscle, FatigueSource[]>> = {},
  now = new Date(),
  aggressiveness: RecoveryAggressiveness = 'balanced',
): MuscleState[] {
  const timestamp = now.toISOString()
  return MUSCLES.map((muscle) => {
    const existing = states.find((state) => state.muscle === muscle)
      ?? createFreshMuscleStates(now).find((state) => state.muscle === muscle)!
    const recovered = getMuscleRecovery(existing, now, aggressiveness)
    const fatigue = clamp(workoutFatigue[muscle] ?? 0, 0, FATIGUE.maxWorkoutFatigue)
    return {
      ...existing,
      recovery: Math.round(clamp(recovered - fatigue, 0, 100)),
      lastUpdatedAt: timestamp,
      lastTrainedAt: fatigue > 0 ? timestamp : existing.lastTrainedAt,
      recoveryWindowHours: fatigue > 0 ? recoveryWindowForFatigue(fatigue) : existing.recoveryWindowHours,
      sources: fatigue > 0
        ? [...(sources[muscle] ?? []), ...existing.sources].slice(0, 12)
        : existing.sources,
      manualAdjustment: 0,
    }
  })
}

export function recoveryLabel(recovery: number): 'Ready' | 'Mostly Ready' | 'Recovering' | 'Fatigued' {
  if (recovery >= 85) return 'Ready'
  if (recovery >= 65) return 'Mostly Ready'
  if (recovery >= 40) return 'Recovering'
  return 'Fatigued'
}

