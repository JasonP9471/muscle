import { describe, expect, it } from 'vitest'
import { calculateEstimatedOneRepMax, calculateVolume } from '.'

describe('strength calculations', () => {
  it('calculates a known Epley estimate', () => expect(calculateEstimatedOneRepMax(100, 10)).toBe(133.3))
  it('does not apply Epley naively to high reps', () => expect(calculateEstimatedOneRepMax(100, 20)).toBeNull())
  it('calculates total volume', () => expect(calculateVolume([{weight:100,reps:10},{weight:100,reps:8}])).toBe(1800))
})

