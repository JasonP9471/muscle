import { describe, expect, it } from 'vitest'
import type { TrainOSBackup } from '../../db/backup'
import { decideSyncAction, fingerprintBackup } from './provider'

function createBackup(): TrainOSBackup {
  return {
    app: 'TrainOS',
    version: 3,
    exportedAt: '2026-09-29T00:00:00.000Z',
    tables: {
      profiles: [{ id: 'primary', name: 'Athlete', age: 30, preferences: { goal: 'build_muscle', split: 'Full Body' } }],
      gymProfiles: [], exercises: [], exercisePreferences: [], workoutTemplates: [], workouts: [],
      workoutExercises: [], setLogs: [], muscleStates: [], bodyMetrics: [], personalRecords: [],
      activeWorkout: [], draftWorkouts: [],
      appSettings: [{ id: 'primary', onboardingComplete: true, theme: 'system', lastCloudSyncAt: '2026-09-29T00:00:00.000Z' }],
      nutritionTargets: [], foods: [], meals: [], mealItems: [], favoriteFoods: [], savedMeals: [],
      savedMealItems: [], weeklyCheckins: [], progressPhotos: [], adaptiveRecommendations: [],
    },
  }
}

function reorderObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderObjectKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).reverse().map(([key, nestedValue]) => [key, reorderObjectKeys(nestedValue)]))
}

describe('account sync decisions', () => {
  it('fingerprints semantically identical JSONB snapshots consistently after key reordering', () => {
    const browserBackup = createBackup()
    const jsonbBackup = reorderObjectKeys(browserBackup) as TrainOSBackup

    expect(JSON.stringify(browserBackup)).not.toBe(JSON.stringify(jsonbBackup))
    expect(fingerprintBackup(browserBackup)).toBe(fingerprintBackup(jsonbBackup))
  })

  it('ignores sync timestamps but preserves meaningful array order in fingerprints', () => {
    const first = createBackup()
    const timestampOnlyChange = createBackup()
    timestampOnlyChange.tables.appSettings[0] = {
      ...timestampOnlyChange.tables.appSettings[0] as Record<string, unknown>,
      lastCloudSyncAt: '2026-09-30T00:00:00.000Z',
    }
    const reorderedProfiles = createBackup()
    reorderedProfiles.tables.profiles.push({ id: 'secondary', name: 'Second profile' })
    const reversedProfiles = structuredClone(reorderedProfiles)
    reversedProfiles.tables.profiles.reverse()

    expect(fingerprintBackup(first)).toBe(fingerprintBackup(timestampOnlyChange))
    expect(fingerprintBackup(reorderedProfiles)).not.toBe(fingerprintBackup(reversedProfiles))
  })

  it('recognizes identical device and cloud copies', () => {
    expect(decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'same',
      remoteFingerprint: 'same',
      lastSyncedFingerprint: 'older',
    })).toBe('unchanged')
  })

  it('restores cloud data onto a fresh device', () => {
    expect(decideSyncAction({
      hasMeaningfulLocalData: false,
      localFingerprint: 'seed-data',
      remoteFingerprint: 'account-data',
      lastSyncedFingerprint: null,
    })).toBe('download')
  })

  it('uploads when only the local device changed', () => {
    expect(decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'local-change',
      remoteFingerprint: 'last-sync',
      lastSyncedFingerprint: 'last-sync',
    })).toBe('upload')
  })

  it('downloads when only the cloud copy changed', () => {
    expect(decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'last-sync',
      remoteFingerprint: 'remote-change',
      lastSyncedFingerprint: 'last-sync',
    })).toBe('download')
  })

  it('blocks simultaneous edits instead of silently overwriting them', () => {
    expect(decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'local-change',
      remoteFingerprint: 'remote-change',
      lastSyncedFingerprint: 'last-sync',
    })).toBe('conflict')
  })

  it('blocks an unknown local profile from claiming an existing account copy', () => {
    expect(decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'unclaimed-local-data',
      remoteFingerprint: 'existing-account-data',
      lastSyncedFingerprint: null,
    })).toBe('conflict')
  })

  it('restores an explicit one-time import over an unclaimed starter profile', () => {
    expect(decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'starter-profile',
      remoteFingerprint: 'muscle-os-profile',
      lastSyncedFingerprint: null,
      remoteIsExplicitImport: true,
    })).toBe('download')
  })

  it('supports a complete two-device handoff without overwriting either device', () => {
    const importedCloud = 'muscle-os-profile'

    const deviceAFirstSync = decideSyncAction({
      hasMeaningfulLocalData: false,
      localFingerprint: 'device-a-seed',
      remoteFingerprint: importedCloud,
      lastSyncedFingerprint: null,
    })
    expect(deviceAFirstSync).toBe('download')

    const deviceAUpload = decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'device-a-workout',
      remoteFingerprint: importedCloud,
      lastSyncedFingerprint: importedCloud,
    })
    expect(deviceAUpload).toBe('upload')

    const deviceBFirstSync = decideSyncAction({
      hasMeaningfulLocalData: false,
      localFingerprint: 'device-b-seed',
      remoteFingerprint: 'device-a-workout',
      lastSyncedFingerprint: null,
    })
    expect(deviceBFirstSync).toBe('download')

    const deviceBUpload = decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'device-b-workout',
      remoteFingerprint: 'device-a-workout',
      lastSyncedFingerprint: 'device-a-workout',
    })
    expect(deviceBUpload).toBe('upload')

    const deviceADownload = decideSyncAction({
      hasMeaningfulLocalData: true,
      localFingerprint: 'device-a-workout',
      remoteFingerprint: 'device-b-workout',
      lastSyncedFingerprint: 'device-a-workout',
    })
    expect(deviceADownload).toBe('download')
  })
})
