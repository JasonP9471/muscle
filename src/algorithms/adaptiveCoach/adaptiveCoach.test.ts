import { describe, expect, it } from 'vitest'
import { generateAdaptiveRecommendations } from '.'
import { createFreshMuscleStates } from '../recovery'
import type { NutritionTargets, Profile } from '../../types'

const profile: Profile = { id:'primary',name:'Jason',age:30,height:188,bodyWeight:190,units:'lb',experienceLevel:'intermediate',goal:'build_muscle',primaryGoal:'build_muscle',split:'Push / Pull / Legs',workoutsPerWeek:4,workoutDays:[1,3,5,6],sessionDuration:60,createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-01T00:00:00Z' }
const targets: NutritionTargets = { id:'primary',calories:3150,protein:190,carbs:380,fat:75,maintenanceCalories:2925,source:'calculated',effectiveFrom:'2026-08-01T00:00:00Z',updatedAt:'2026-08-01T00:00:00Z' }

describe('adaptive coach', () => {
  it('joins nutrition, recovery, and training gaps into prioritized guidance', () => {
    const states = createFreshMuscleStates(new Date('2026-08-25T12:00:00Z'))
    states[0].recovery = 30
    const result = generateAdaptiveRecommendations({ profile, targets, todayItems:[],recentDailyCalories:[],bodyMetrics:[],muscleStates:states,workouts:[],now:new Date('2026-08-25T12:00:00Z') })
    expect(result.some((item) => item.id === 'protein-gap')).toBe(true)
    expect(result.some((item) => item.id === 'low-recovery')).toBe(true)
    expect(result.some((item) => item.id === 'schedule-gap')).toBe(true)
  })

  it('returns an on-track state when signals need no intervention', () => {
    const todayItems = [{ id:'1',mealId:'meal',name:'Food',servingLabel:'1',quantity:1,calories:3100,protein:185,carbs:370,fat:75 }]
    const workouts = Array.from({ length: 4 }, (_, index) => ({ id:String(index),title:'Session',splitDay:'Full Body',startedAt:'2026-08-24T10:00:00Z',completedAt:'2026-08-24T11:00:00Z',durationSeconds:3600,totalVolume:1000,totalReps:30,workingSets:9,focusMuscles:[] as [],prCount:0 }))
    const result = generateAdaptiveRecommendations({ profile, targets, todayItems,recentDailyCalories:[3100,3150,3200],bodyMetrics:[],muscleStates:createFreshMuscleStates(new Date('2026-08-25T12:00:00Z')),workouts,now:new Date('2026-08-25T12:00:00Z') })
    expect(result[0].id).toBe('on-track')
  })
})
