import { describe, expect, it } from 'vitest'
import { DURATION_GUIDANCE } from '../../config/training'
import { EXERCISE_BY_ID } from '../../data/exercises'
import type { ExerciseScoreContext, WorkoutGenerationInput } from '../../types'
import { generateWorkout, generateWorkoutVariation } from '.'
import { calculateExerciseScore } from './scoring'

const baseInput = (overrides: Partial<WorkoutGenerationInput> = {}): WorkoutGenerationInput => ({
  goal: 'build_muscle', experienceLevel: 'intermediate', split: 'Push / Pull / Legs', workoutDuration: 45,
  equipment: ['bodyweight','barbell','bench','dumbbells','cable machine','functional trainer','pull-up bar','squat rack'],
  muscleRecovery: {}, exerciseHistory: [], exercisePreferences: {}, excludedExercises: [], previousWorkouts: [],
  trainingFrequency: 4, varietyPreference: 'balanced', supersetsAllowed: true, warmupEnabled: true,
  cardioFinishersAllowed: false, ...overrides,
})

describe('workout generation', () => {
  it('follows split progression and chooses a push workout first', () => {
    const plan = generateWorkout(baseInput())
    expect(plan.splitDay).toBe('Push')
    expect(plan.exercises.every((item) => {
      const exercise = EXERCISE_BY_ID.get(item.exerciseId)!
      return [...exercise.primaryMuscles, ...exercise.secondaryMuscles].some(({ muscle }) => ['chest','upper chest','front delts','side delts','triceps'].includes(muscle))
    })).toBe(true)
  })

  it('respects equipment restrictions', () => {
    const plan = generateWorkout(baseInput({ equipment: ['bodyweight'], split: 'Full Body' }))
    expect(plan.exercises.every((item) => EXERCISE_BY_ID.get(item.exerciseId)!.requiredEquipment.every((equipment) => equipment === 'bodyweight'))).toBe(true)
  })

  it('derives the full-body label from the exercises actually selected', () => {
    const plan = generateWorkout(baseInput({ split: 'Full Body', workoutDuration: 60 }))
    const selectedMuscles = new Set(plan.exercises.flatMap(({ exerciseId }) => {
      const exercise = EXERCISE_BY_ID.get(exerciseId)!
      return [...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(({ muscle }) => muscle)
    }))
    expect(plan.title).toBe(`Full Body · ${plan.focusMuscles.map((muscle) => muscle.replace(/\b\w/g, (character) => character.toUpperCase())).join(' / ')}`)
    expect(plan.focusMuscles.every((muscle) => selectedMuscles.has(muscle))).toBe(true)
    expect(plan.title).not.toMatch(/Build|Strength|Performance|Endurance/)
  })

  it('never returns an excluded exercise', () => {
    const excluded = 'barbell-bench-press'
    const plan = generateWorkout(baseInput({ excludedExercises: [excluded], exercisePreferences: { [excluded]: 'exclude' } }))
    expect(plan.exercises.map((item) => item.exerciseId)).not.toContain(excluded)
  })

  it.each([15,30,45,60,75,90] as const)('materially fits a %s-minute duration', (duration) => {
    const plan = generateWorkout(baseInput({ workoutDuration: duration }))
    const [min, max] = DURATION_GUIDANCE[duration].exercises
    expect(plan.exercises.length).toBeGreaterThanOrEqual(min)
    expect(plan.exercises.length).toBeLessThanOrEqual(max)
    expect(plan.estimatedDuration).toBeLessThanOrEqual(duration + 8)
  })

  it('boosts preferred exercises', () => {
    const exercise = EXERCISE_BY_ID.get('barbell-bench-press')!
    const context: ExerciseScoreContext = { goal:'build_muscle',experienceLevel:'intermediate',equipment:baseInput().equipment,targetMuscles:['chest'],muscleRecovery:{chest:100},excluded:false,recentExerciseIds:[],neededPatterns:['horizontal_push'],varietyPreference:'balanced',preference:'neutral' }
    const favorite = calculateExerciseScore(exercise, { ...context, preference:'favorite' })
    const neutral = calculateExerciseScore(exercise, context)
    expect(favorite).toBeGreaterThan(neutral)
  })

  it('deprioritizes exercises whose target muscle is heavily fatigued', () => {
    const exercise = EXERCISE_BY_ID.get('barbell-bench-press')!
    const base = { goal:'build_muscle' as const,experienceLevel:'intermediate' as const,equipment:baseInput().equipment,targetMuscles:['chest'] as const,preference:'neutral' as const,excluded:false,recentExerciseIds:[],neededPatterns:['horizontal_push'] as const,varietyPreference:'balanced' as const }
    const ready = calculateExerciseScore(exercise, { ...base, targetMuscles:[...base.targetMuscles],neededPatterns:[...base.neededPatterns],muscleRecovery:{chest:100} })
    const fatigued = calculateExerciseScore(exercise, { ...base,targetMuscles:[...base.targetMuscles],neededPatterns:[...base.neededPatterns],muscleRecovery:{chest:20} })
    expect(fatigued).toBeLessThan(ready - 30)
  })

  it('uses strength-specific reps and balances movement patterns', () => {
    const plan = generateWorkout(baseInput({ goal:'build_strength', workoutDuration:60 }))
    expect(plan.exercises[0].sets[0].targetRepMax).toBeLessThanOrEqual(6)
    const patterns = new Set(plan.exercises.map((item) => EXERCISE_BY_ID.get(item.exerciseId)!.movementPattern))
    expect(patterns.size).toBeGreaterThanOrEqual(3)
  })

  it('avoids advanced movements for a beginner when suitable options exist', () => {
    const plan = generateWorkout(baseInput({ experienceLevel:'beginner' }))
    expect(plan.exercises.filter((item) => EXERCISE_BY_ID.get(item.exerciseId)!.difficulty === 'advanced')).toHaveLength(0)
  })

  it('creates a controlled variation without changing the workout focus or main lift', () => {
    const input = baseInput()
    const original = generateWorkout(input)
    const variation = generateWorkoutVariation(original, input)
    const originalIds = original.exercises.map(({ exerciseId }) => exerciseId)
    const variationIds = variation.plan.exercises.map(({ exerciseId }) => exerciseId)

    expect(variation.changedExercises).toHaveLength(2)
    expect(variation.plan.splitDay).toBe(original.splitDay)
    expect(variation.plan.focusMuscles).toEqual(original.focusMuscles)
    expect(variation.plan.exercises).toHaveLength(original.exercises.length)
    expect(variationIds[0]).toBe(originalIds[0])
    expect(variationIds.filter((id, index) => id !== originalIds[index])).toHaveLength(2)
    expect(variation.plan.exercises.every(({ exerciseId }) => EXERCISE_BY_ID.get(exerciseId)!.requiredEquipment
      .every((equipment) => input.equipment.includes(equipment)))).toBe(true)
  })

  it('moves on to different alternatives when another variation is requested', () => {
    const input = baseInput()
    const original = generateWorkout(input)
    const first = generateWorkoutVariation(original, input)
    const second = generateWorkoutVariation(first.plan, input)
    const firstIds = first.plan.exercises.map(({ exerciseId }) => exerciseId)
    const secondIds = second.plan.exercises.map(({ exerciseId }) => exerciseId)

    expect(second.changedExercises.length).toBeGreaterThan(0)
    expect(secondIds).not.toEqual(firstIds)
    expect(second.plan.splitDay).toBe(original.splitDay)
  })
})
