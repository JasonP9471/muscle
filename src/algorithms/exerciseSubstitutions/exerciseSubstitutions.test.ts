import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID } from '../../data/exercises'
import type { WorkoutGenerationInput } from '../../types'
import { buildExerciseSubstitutions, getRecognizedLimitationLabels, isExerciseBlockedByLimitations } from '.'

const baseInput = (overrides: Partial<WorkoutGenerationInput> = {}): WorkoutGenerationInput => ({
  goal: 'build_muscle',
  experienceLevel: 'intermediate',
  split: 'Push / Pull / Legs',
  workoutDuration: 45,
  equipment: ['bodyweight', 'barbell', 'bench', 'dumbbells', 'cable machine', 'functional trainer', 'chest press'],
  muscleRecovery: {},
  exerciseHistory: [],
  exercisePreferences: {},
  excludedExercises: [],
  previousWorkouts: [],
  trainingFrequency: 4,
  varietyPreference: 'balanced',
  ...overrides,
})

describe('exercise substitutions', () => {
  const benchPress = EXERCISE_BY_ID.get('barbell-bench-press')!

  it('prioritizes the same pattern, primary muscles, and difficulty with specific explanations', () => {
    const result = buildExerciseSubstitutions(benchPress, baseInput())
    const dumbbellBench = result.alternatives.find(({ exercise }) => exercise.id === 'dumbbell-bench-press')

    expect(result.alternatives[0].exercise.movementPattern).toBe('horizontal_push')
    expect(dumbbellBench?.matchQuality).toBe('Best match')
    expect(dumbbellBench?.reasons).toEqual(expect.arrayContaining([
      'Same horizontal push pattern',
      'Targets Chest',
      'Uses your available dumbbells and bench',
      'Same beginner difficulty',
    ]))
  })

  it('hard-filters unavailable equipment and preference exclusions', () => {
    const result = buildExerciseSubstitutions(benchPress, baseInput({
      equipment: ['bodyweight'],
      excludedExercises: ['push-up'],
      exercisePreferences: { 'push-up': 'exclude' },
    }))

    expect(result.alternatives.every(({ exercise }) => exercise.requiredEquipment.every((item) => item === 'bodyweight'))).toBe(true)
    expect(result.alternatives.map(({ exercise }) => exercise.id)).not.toContain('push-up')
  })

  it('recognizes saved limitations and filters direct conflicts', () => {
    const squat = EXERCISE_BY_ID.get('barbell-back-squat')!
    const result = buildExerciseSubstitutions(squat, baseInput({ limitations: 'Previous ACL injury in my right knee' }))

    expect(result.limitationLabels).toContain('knee')
    expect(result.alternatives.every(({ exercise }) => !isExerciseBlockedByLimitations(exercise, 'ACL knee injury'))).toBe(true)
    expect(result.alternatives.every(({ reasons }) => reasons.some((reason) => reason.includes('saved knee filter')))).toBe(true)
  })

  it('does not activate a limitation that the profile explicitly negates', () => {
    expect(getRecognizedLimitationLabels('No knee or shoulder issues')).toEqual([])
  })

  it('does not suggest advanced substitutions to a beginner', () => {
    const result = buildExerciseSubstitutions(benchPress, baseInput({ experienceLevel: 'beginner' }))
    expect(result.alternatives.some(({ exercise }) => exercise.difficulty === 'advanced')).toBe(false)
  })
})
