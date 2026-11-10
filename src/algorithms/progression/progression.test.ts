import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID } from '../../data/exercises'
import { calculateNextPrescription, detectPlateau, recommendWeight } from '.'

const bench = EXERCISE_BY_ID.get('barbell-bench-press')!
const sets = (weight: number, reps: number, rir = 2) => Array.from({ length: 3 }, () => ({ weight, reps, rir }))

describe('progressive overload', () => {
  it('increases load after reaching the top of the range', () => {
    const result = calculateNextPrescription({ exercise:bench, previousSets:sets(100,10), targetRepRange:[6,10], units:'lb' })
    expect(result.action).toBe('increase_weight')
    expect(result.weight).toBeGreaterThan(100)
  })

  it('maintains load and increases reps inside the range', () => {
    const result = calculateNextPrescription({ exercise:bench, previousSets:sets(100,8), targetRepRange:[6,10], units:'lb' })
    expect(result.action).toBe('increase_reps')
    expect(result.weight).toBe(100)
    expect(result.targetReps).toBe(9)
  })

  it('reduces load after repeated misses below the minimum', () => {
    const result = calculateNextPrescription({ exercise:bench, previousSets:sets(100,4,0), targetRepRange:[6,10], units:'lb' })
    expect(result.action).toBe('reduce_weight')
    expect(result.weight).toBeLessThan(100)
  })

  it('gives a safe first-session recommendation', () => {
    const result = calculateNextPrescription({ exercise:bench, previousSets:[], targetRepRange:[6,10], units:'lb' })
    expect(result.action).toBe('first_session')
    expect(result.weight).toBeUndefined()
  })

  it('prevents unrealistic jumps and detects plateaus', () => {
    expect(recommendWeight(bench, 100, 'increase', 'lb')).toBeLessThanOrEqual(107.5)
    expect(detectPlateau([sets(100,8),sets(100,8),sets(100,8)])).toBe(true)
  })
})

