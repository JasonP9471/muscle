import type { Goal, MovementPattern } from '../types'

export const EFFORT_FACTORS: Record<number, number> = {
  0: 1.2,
  1: 1.1,
  2: 1,
  3: 0.9,
  4: 0.75,
  5: 0.75,
}

export const FATIGUE = {
  baseSetCost: 4.6,
  primaryMultiplier: 1,
  secondaryMultiplier: 0.48,
  compoundMultiplier: 1.08,
  isolationMultiplier: 0.88,
  maxWorkoutFatigue: 88,
  minimumRecoveryWindowHours: 48,
  normalRecoveryWindowHours: 84,
  maximumRecoveryWindowHours: 144,
  experienceMultiplier: { beginner: 1.08, intermediate: 1, advanced: 0.94 },
  aggressivenessRate: { conservative: 0.9, balanced: 1, aggressive: 1.12 },
} as const

export const REP_RANGES: Record<Goal, { main: [number, number]; compound: [number, number]; isolation: [number, number] }> = {
  build_muscle: { main: [6, 10], compound: [8, 12], isolation: [10, 15] },
  build_strength: { main: [3, 6], compound: [5, 8], isolation: [6, 12] },
  general_fitness: { main: [6, 10], compound: [8, 12], isolation: [10, 15] },
  muscular_endurance: { main: [12, 16], compound: [12, 18], isolation: [15, 22] },
}

export const REST_RANGES: Record<Goal, { compound: number; isolation: number }> = {
  build_muscle: { compound: 120, isolation: 75 },
  build_strength: { compound: 210, isolation: 105 },
  general_fitness: { compound: 105, isolation: 60 },
  muscular_endurance: { compound: 75, isolation: 45 },
}

export const DURATION_GUIDANCE = {
  15: { exercises: [2, 3], target: 3 },
  30: { exercises: [3, 5], target: 4 },
  45: { exercises: [4, 6], target: 5 },
  60: { exercises: [5, 7], target: 6 },
  75: { exercises: [6, 8], target: 7 },
  90: { exercises: [7, 10], target: 9 },
} as const

export const DURATION_ASSUMPTIONS = {
  secondsPerWorkingSet: 38,
  secondsPerTransition: 75,
  warmupMinutes: 6,
  cooldownMinutes: 4,
  cardioMinutes: 8,
  setupSecondsPerExercise: 35,
} as const

export const PROGRESSION = {
  upperBodyPercent: 0.035,
  lowerBodyPercent: 0.04,
  reductionPercent: 0.075,
  maxIncreasePercent: 0.075,
  plateauSessions: 3,
  defaultIncrementLb: 5,
  defaultIncrementKg: 2.5,
  dumbbellIncrementLb: 5,
  dumbbellIncrementKg: 2,
} as const

export const EXERCISE_SCORE_WEIGHTS = {
  goalAlignment: 14,
  targetMuscle: 30,
  recovery: 18,
  movementNeed: 15,
  favorite: 18,
  recommendMore: 9,
  recommendLess: -12,
  recentRepeat: -10,
  difficultyMatch: 8,
  compoundPriority: 10,
  varietyHighNovelty: 7,
  varietyLowFamiliarity: 8,
} as const

export const SPLIT_PATTERNS: Record<string, MovementPattern[]> = {
  Push: ['horizontal_push', 'vertical_push', 'isolation'],
  Pull: ['horizontal_pull', 'vertical_pull', 'hinge', 'isolation'],
  Legs: ['squat', 'hinge', 'lunge', 'isolation'],
  Upper: ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'isolation'],
  Lower: ['squat', 'hinge', 'lunge', 'isolation'],
  'Full Body': ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'core'],
}

export const WEEKLY_VOLUME_GUIDANCE = {
  beginner: { min: 6, max: 10 },
  intermediate: { min: 8, max: 16 },
  advanced: { min: 10, max: 20 },
} as const

