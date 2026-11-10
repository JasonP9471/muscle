import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID } from '../../data/exercises'
import { getExerciseGuidance } from '.'

describe('exercise guidance', () => {
  it('provides exercise-specific setup and mistake cues for major lifts', () => {
    const guidance = getExerciseGuidance(EXERCISE_BY_ID.get('barbell-bench-press')!)
    expect(guidance.setup.join(' ')).toContain('spotter')
    expect(guidance.commonMistakes.join(' ')).toContain('Bouncing')
    expect(guidance.tempo).toContain('sec')
  })

  it('provides complete fallback guidance for every catalog movement', () => {
    for (const exercise of EXERCISE_BY_ID.values()) {
      const guidance = getExerciseGuidance(exercise)
      expect(guidance.setup.length).toBeGreaterThanOrEqual(2)
      expect(guidance.execution.length).toBeGreaterThanOrEqual(2)
      expect(guidance.commonMistakes.length).toBeGreaterThanOrEqual(2)
      expect(guidance.breathing).toBeTruthy()
      expect(guidance.adjustment).toBeTruthy()
      expect(guidance.safetyNote).toBeTruthy()
    }
  })

  it('adapts easier-variation advice to exercise type', () => {
    expect(getExerciseGuidance(EXERCISE_BY_ID.get('assisted-pull-up')!).adjustment).toContain('assistance')
    expect(getExerciseGuidance(EXERCISE_BY_ID.get('push-up')!).adjustment).toContain('easier angle')
    expect(getExerciseGuidance(EXERCISE_BY_ID.get('treadmill-walk')!).adjustment).toContain('interval')
  })
})
