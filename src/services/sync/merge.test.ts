import { describe, expect, it } from 'vitest'
import { BACKUP_TABLE_NAMES, type TrainOSBackup } from '../../db/backup'
import type { ActiveWorkout } from '../../types'
import { mergeActiveWorkout, mergeSnapshots } from './merge'

function backup(overrides: Partial<TrainOSBackup['tables']> = {}): TrainOSBackup {
  const tables = Object.fromEntries(BACKUP_TABLE_NAMES.map((table) => [table, []])) as unknown as TrainOSBackup['tables']
  return { app: 'TrainOS', version: 4, exportedAt: '2026-10-12T12:00:00.000Z', tables: { ...tables, ...overrides } }
}

function active(autosavedAt: string): ActiveWorkout {
  return {
    id: 'active', planId: 'plan', title: 'Full body', splitDay: 'Full Body', focusMuscles: ['chest'],
    estimatedDuration: 30, readiness: 90, explanation: 'Test', createdAt: autosavedAt,
    manuallyEdited: false, startedAt: autosavedAt, elapsedBeforeStart: 0, autosavedAt,
    restTimer: { durationSeconds: 0, remainingSeconds: 0, running: false },
    exercises: [{
      id: 'exercise-1', exerciseId: 'barbell-bench-press', order: 0, notes: '',
      sets: [{ id: 'set-1', setNumber: 1, targetRepMin: 8, targetRepMax: 10, restSeconds: 90, completed: false }],
    }],
  }
}

describe('record-level account merging', () => {
  it('keeps independent phone workout and desktop meal additions', () => {
    const base = backup()
    const local = backup({ workouts: [{ id: 'workout-1', completedAt: '2026-10-12T12:01:00.000Z' }] })
    const remote = backup({ meals: [{ id: 'meal-1', createdAt: '2026-10-12T12:02:00.000Z' }] })

    const result = mergeSnapshots(base, local, remote)

    expect(result.backup.tables.workouts).toHaveLength(1)
    expect(result.backup.tables.meals).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
  })

  it('merges profile edits to different fields without a conflict', () => {
    const profile = { id: 'primary', name: 'Jay', bodyWeight: 190, updatedAt: '2026-10-12T12:00:00.000Z' }
    const base = backup({ profiles: [profile] })
    const local = backup({ profiles: [{ ...profile, name: 'Jason', updatedAt: '2026-10-12T12:01:00.000Z' }] })
    const remote = backup({ profiles: [{ ...profile, bodyWeight: 191, updatedAt: '2026-10-12T12:02:00.000Z' }] })

    const result = mergeSnapshots(base, local, remote)

    expect(result.backup.tables.profiles[0]).toMatchObject({ name: 'Jason', bodyWeight: 191 })
    expect(result.conflicts).toHaveLength(0)
  })

  it('keeps an edited record when the other device deleted it', () => {
    const meal = { id: 'meal-1', name: 'Lunch', createdAt: '2026-10-12T12:00:00.000Z' }
    const result = mergeSnapshots(
      backup({ meals: [meal] }),
      backup({ meals: [] }),
      backup({ meals: [{ ...meal, name: 'Post-workout lunch' }] }),
    )

    expect(result.backup.tables.meals[0]).toMatchObject({ name: 'Post-workout lunch' })
    expect(result.conflicts[0].resolution).toBe('kept_existing')
  })

  it('merges concurrent active-workout set fields so neither input is lost', () => {
    const base = active('2026-10-12T12:00:00.000Z')
    const weight = structuredClone(base)
    weight.exercises[0].sets[0].weight = 185
    weight.autosavedAt = '2026-10-12T12:01:00.000Z'
    const reps = structuredClone(base)
    reps.exercises[0].sets[0].reps = 8
    reps.exercises[0].sets[0].completed = true
    reps.autosavedAt = '2026-10-12T12:02:00.000Z'

    const merged = mergeActiveWorkout(base, weight, reps)

    expect(merged.exercises[0].sets[0]).toMatchObject({ weight: 185, reps: 8, completed: true })
  })
})
