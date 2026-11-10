import { describe, expect, it } from 'vitest'
import illustratedExerciseIds from '../../public/exercise-guides/library/index.json'
import { EXERCISES } from './exercises'

describe('exercise illustrations', () => {
  it('provides a local start-and-finish visual for every exercise', () => {
    const illustrated = new Set(illustratedExerciseIds)
    const missing = EXERCISES.filter((exercise) => !illustrated.has(exercise.id)).map((exercise) => exercise.name)

    expect(missing).toEqual([])
    expect(EXERCISES).toHaveLength(231)
  })
})
