import { describe, expect, it } from 'vitest'
import { detectPersonalRecords } from '.'

describe('personal records', () => {
  it('detects meaningful new records', () => {
    const records = detectPersonalRecords('w2','2026-01-02',[{exerciseId:'bench',weight:105,reps:10}],[{exerciseId:'bench',weight:100,reps:8}],[])
    expect(records.some((record) => record.type === 'weight')).toBe(true)
    expect(records.some((record) => record.type === 'estimated_1rm')).toBe(true)
  })

  it('does not create false weight, rep, or strength PRs for equal performance', () => {
    const previous = [{exerciseId:'bench',weight:100,reps:8}]
    const existing = [{id:'r1',exerciseId:'bench',workoutId:'w1',type:'exercise_volume' as const,value:800,achievedAt:'2026-01-01'},{id:'r2',workoutId:'w1',type:'workout_volume' as const,value:800,achievedAt:'2026-01-01'}]
    const records = detectPersonalRecords('w2','2026-01-02',previous,previous,existing)
    expect(records).toHaveLength(0)
  })
})

