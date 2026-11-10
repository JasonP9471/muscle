import { describe, expect, it } from 'vitest'
import { calculateStreak, calculateTrainingDistribution } from '.'
import { EXERCISE_BY_ID } from '../../data/exercises'
import type { SetLog, WorkoutRecord } from '../../types'

const workout = (id: string, completedAt: string): WorkoutRecord => ({ id,title:'Test',splitDay:'Push',startedAt:completedAt,completedAt,durationSeconds:3000,totalVolume:1000,totalReps:30,workingSets:3,focusMuscles:['chest'],prCount:0 })

describe('analytics', () => {
  it('calculates weekly consistency streaks', () => {
    const now = new Date('2026-01-21T12:00:00Z')
    const workouts = [workout('1','2026-01-05T12:00:00Z'),workout('2','2026-01-06T12:00:00Z'),workout('3','2026-01-12T12:00:00Z'),workout('4','2026-01-13T12:00:00Z')]
    expect(calculateStreak(workouts,2,now)).toEqual({current:2,longest:2})
  })

  it('calculates muscle training distribution', () => {
    const set: SetLog = {id:'s',workoutId:'w',workoutExerciseId:'we',exerciseId:'barbell-bench-press',setNumber:1,weight:100,reps:8,rir:2,completedAt:'2026-01-01'}
    const distribution = calculateTrainingDistribution([set],EXERCISE_BY_ID)
    expect(distribution.find((item)=>item.muscle==='chest')!.sets).toBe(1)
    expect(distribution.find((item)=>item.muscle==='triceps')!.sets).toBe(.5)
  })
})

