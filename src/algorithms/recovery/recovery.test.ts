import { describe, expect, it } from 'vitest'
import { calculateRecoveryPercentage, calculateSetFatigue, calculateWorkoutFatigue, createFreshMuscleStates, getMuscleRecovery, updateRecoveryStates } from '.'
import { EXERCISE_BY_ID } from '../../data/exercises'

const bench = EXERCISE_BY_ID.get('barbell-bench-press')!

describe('muscle recovery', () => {
  it('starts every muscle fresh', () => {
    expect(createFreshMuscleStates().every((state) => state.recovery === 100)).toBe(true)
  })

  it('reduces recovery when a muscle is newly trained', () => {
    const fatigue = calculateWorkoutFatigue([{ exercise: bench, sets: Array.from({ length: 4 }, () => ({ reps: 8, weight: 135, rir: 2 })) }])
    const updated = updateRecoveryStates(createFreshMuscleStates(), fatigue)
    expect(updated.find((state) => state.muscle === 'chest')!.recovery).toBeLessThan(90)
    expect(updated.find((state) => state.muscle === 'calves')!.recovery).toBe(100)
  })

  it('recovers with elapsed time', () => {
    expect(calculateRecoveryPercentage(50, 42, 84)).toBe(75)
    const state = { ...createFreshMuscleStates(new Date('2026-01-01T00:00:00Z'))[0], recovery: 50, recoveryWindowHours: 84 }
    expect(getMuscleRecovery(state, new Date('2026-01-04T12:00:00Z'))).toBe(100)
  })

  it('clamps extreme workout volume', () => {
    const fatigue = calculateWorkoutFatigue([{ exercise: bench, sets: Array.from({ length: 100 }, () => ({ reps: 12, weight: 225, rir: 0 })) }])
    expect(fatigue.chest).toBeLessThanOrEqual(88)
  })

  it('assigns more fatigue to lower RIR sets and primary muscles', () => {
    const hard = calculateSetFatigue(bench, { reps: 8, weight: 135, rir: 0 })
    const easy = calculateSetFatigue(bench, { reps: 8, weight: 135, rir: 4 })
    expect(hard.chest!).toBeGreaterThan(easy.chest!)
    expect(hard.chest!).toBeGreaterThan(hard.triceps!)
  })
})

