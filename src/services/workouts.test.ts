import { describe, expect, it } from 'vitest'
import type { SetLog, WorkoutPlan } from '../types'
import { prefillPlanFromHistory, validateSetForExercise } from './workouts'

describe('workout set validation', () => {
  it('requires load and reps for weighted exercises', () => {
    const base = { id:'set',setNumber:1,targetRepMin:6,targetRepMax:10,restSeconds:120,completed:false }
    expect(validateSetForExercise('barbell-bench-press', { ...base, reps: 8 })).toMatch(/weight/i)
    expect(validateSetForExercise('barbell-bench-press', { ...base, weight: 225 })).toMatch(/repetition/i)
    expect(validateSetForExercise('barbell-bench-press', { ...base, weight: 225, reps: 8 })).toBeNull()
  })

  it('allows bodyweight work without a fabricated load', () => {
    const set = { id:'set',setNumber:1,targetRepMin:8,targetRepMax:15,restSeconds:60,completed:false,reps:12 }
    expect(validateSetForExercise('push-up', set)).toBeNull()
  })
})

describe('workout history prefilling', () => {
  it('uses the latest session values without replacing manual entries', () => {
    const plan: WorkoutPlan = {
      id:'plan',title:'Push',splitDay:'Push',focusMuscles:[],estimatedDuration:45,readiness:90,
      explanation:'',createdAt:'2026-01-03T00:00:00Z',manuallyEdited:false,
      exercises:[{ id:'planned',exerciseId:'barbell-bench-press',order:0,notes:'',sets:[
        { id:'s1',setNumber:1,targetRepMin:6,targetRepMax:10,restSeconds:120,completed:false },
        { id:'s2',setNumber:2,targetRepMin:6,targetRepMax:10,restSeconds:120,completed:false,weight:205 },
      ] }],
    }
    const log = (id: string, workoutId: string, setNumber: number, weight: number, reps: number, completedAt: string): SetLog => ({
      id,workoutId,workoutExerciseId:`exercise-${workoutId}`,exerciseId:'barbell-bench-press',setNumber,weight,reps,rir:2,completedAt,
    })
    const history = [
      log('old','old-workout',1,185,10,'2026-01-01T12:00:00Z'),
      log('new-1','new-workout',1,195,8,'2026-01-02T12:00:00Z'),
      log('new-2','new-workout',2,190,9,'2026-01-02T12:00:00Z'),
    ]

    const result = prefillPlanFromHistory(plan, history)

    expect(result.exercises[0].sets[0]).toMatchObject({ weight:195,reps:8 })
    expect(result.exercises[0].sets[1]).toMatchObject({ weight:205,reps:9 })
  })
})
