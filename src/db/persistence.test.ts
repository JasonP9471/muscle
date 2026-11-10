import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from './database'
import { initializeDatabase } from './initialize'
import { exportAllData } from './backup'
import { discardActiveWorkout, finishWorkout, saveActiveWorkout } from '../services/workouts'
import type { ActiveWorkout, WorkoutPlan } from '../types'

describe('active workout persistence', () => {
  beforeAll(async () => { await db.delete(); await db.open(); await initializeDatabase() })
  afterAll(async () => { db.close() })

  it('survives a database close and reopen cycle', async () => {
    const now = new Date().toISOString()
    const active: ActiveWorkout = { id:'active',planId:'plan',title:'Persistence test',splitDay:'Push',focusMuscles:['chest'],estimatedDuration:30,readiness:100,explanation:'Test',createdAt:now,manuallyEdited:false,exercises:[],startedAt:now,elapsedBeforeStart:0,autosavedAt:now,restTimer:{durationSeconds:0,remainingSeconds:0,running:false} }
    await db.activeWorkout.put(active)
    db.close()
    await db.open()
    expect((await db.activeWorkout.get('active'))?.title).toBe('Persistence test')
    const backup = await exportAllData()
    expect(backup.app).toBe('TrainOS')
    expect(backup.tables.activeWorkout).toHaveLength(1)
    expect(backup.tables.exercises.length).toBeGreaterThanOrEqual(150)
  })

  it('does not lose a set when rapid edits are saved and the app database reopens', async () => {
    const now = new Date().toISOString()
    const baseline: ActiveWorkout = {
      id:'active',planId:'close-test',title:'Close test',splitDay:'Full Body',focusMuscles:['chest'],estimatedDuration:30,readiness:100,
      explanation:'Test',createdAt:now,manuallyEdited:false,startedAt:now,elapsedBeforeStart:0,autosavedAt:now,
      restTimer:{durationSeconds:0,remainingSeconds:0,running:false},
      exercises:[{ id:'planned-1',exerciseId:'barbell-bench-press',order:0,notes:'',sets:[{ id:'set-1',setNumber:1,targetRepMin:8,targetRepMax:10,restSeconds:90,completed:false }] }],
    }
    await db.activeWorkout.put(baseline)
    const weightEdit = structuredClone(baseline)
    weightEdit.exercises[0].sets[0].weight = 185
    const repsEdit = structuredClone(baseline)
    repsEdit.exercises[0].sets[0].reps = 8
    const completedEdit = structuredClone(baseline)
    completedEdit.exercises[0].sets[0].completed = true

    await Promise.all([
      saveActiveWorkout(weightEdit, baseline),
      saveActiveWorkout(repsEdit, baseline),
      saveActiveWorkout(completedEdit, baseline),
    ])
    db.close()
    await db.open()

    expect((await db.activeWorkout.get('active'))?.exercises[0].sets[0]).toMatchObject({ weight:185, reps:8, completed:true })
  })

  it('discards an active session while preserving the plan for another choice', async () => {
    const now = new Date().toISOString()
    const plan: WorkoutPlan = { id:'draft-plan',title:'Draft test',splitDay:'Push',focusMuscles:['chest'],estimatedDuration:30,readiness:100,explanation:'Test',createdAt:now,manuallyEdited:false,exercises:[] }
    await db.draftWorkouts.put(plan)
    await discardActiveWorkout()

    expect(await db.activeWorkout.get('active')).toBeUndefined()
    expect((await db.draftWorkouts.get('draft-plan'))?.title).toBe('Draft test')
  })

  it('persists warm-ups in the active session without counting them as working volume', async () => {
    const now = new Date(Date.now() - 10 * 60_000).toISOString()
    const active: ActiveWorkout = {
      id:'active',planId:'warmup-test',title:'Warm-up test',splitDay:'Push',focusMuscles:['chest'],estimatedDuration:30,readiness:100,
      explanation:'Test',createdAt:now,manuallyEdited:false,startedAt:now,elapsedBeforeStart:0,autosavedAt:now,
      restTimer:{durationSeconds:0,remainingSeconds:0,running:false},
      exercises:[{ id:'planned-warmup',exerciseId:'barbell-bench-press',order:0,notes:'',sets:[
        { id:'warmup',setNumber:1,targetRepMin:8,targetRepMax:8,restSeconds:45,completed:true,weight:95,reps:8,rir:5,isWarmup:true },
        { id:'working',setNumber:2,targetRepMin:8,targetRepMax:10,restSeconds:90,completed:true,weight:185,reps:8,rir:2 },
      ] }],
    }

    const record = await finishWorkout(active)
    const savedSets = await db.setLogs.where('workoutId').equals(record.id).toArray()

    expect(record).toMatchObject({ workingSets:1,totalReps:8,totalVolume:1480 })
    expect(savedSets).toHaveLength(1)
    expect(savedSets[0]).toMatchObject({ weight:185,reps:8,setNumber:1 })
  })

  it('persists normalized nutrition records and includes them in backup', async () => {
    const now = new Date().toISOString()
    await db.meals.put({ id:'meal-test',name:'Persistence meal',type:'lunch',loggedAt:now,method:'manual',estimated:false,createdAt:now })
    await db.mealItems.put({ id:'meal-item-test',mealId:'meal-test',name:'Chicken',servingLabel:'6 oz',quantity:1,calories:280,protein:52,carbs:0,fat:6 })
    db.close(); await db.open()
    expect(await db.meals.get('meal-test')).toMatchObject({ name:'Persistence meal',type:'lunch' })
    expect(await db.mealItems.where('mealId').equals('meal-test').count()).toBe(1)
    const backup = await exportAllData()
    expect(backup.version).toBe(4)
    expect(backup.tables.meals).toHaveLength(1)
    expect(backup.tables.foods.length).toBeGreaterThanOrEqual(20)
  })
})
