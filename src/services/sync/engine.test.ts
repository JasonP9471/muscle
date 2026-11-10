import { describe, expect, it } from 'vitest'
import { BACKUP_TABLE_NAMES, type TrainOSBackup } from '../../db/backup'
import {
  ensureDeviceOwner, runAccountSync, type AccountSnapshotRow, type DeviceSyncStore, type RemoteSnapshotStore,
} from './engine'
import type { SnapshotConflict } from './merge'

function backup(overrides: Partial<TrainOSBackup['tables']> = {}): TrainOSBackup {
  const tables = Object.fromEntries(BACKUP_TABLE_NAMES.map((table) => [table, []])) as unknown as TrainOSBackup['tables']
  return { app: 'TrainOS', version: 4, exportedAt: '2026-10-27T12:00:00.000Z', tables: { ...tables, ...overrides } }
}

class TestDevice implements DeviceSyncStore {
  local: TrainOSBackup
  queued = false
  queueAttempts = 0
  lastError?: string
  conflicts: SnapshotConflict[] = []
  lastSyncAt?: string
  readonly baselines = new Map<string, TrainOSBackup>()

  constructor(local: TrainOSBackup, baseline?: TrainOSBackup, userId = 'user-a') {
    this.local = structuredClone(local)
    if (baseline) this.baselines.set(userId, structuredClone(baseline))
  }

  async queueSnapshot(): Promise<void> { this.queued = true }
  async readLocal(): Promise<TrainOSBackup> { return structuredClone(this.local) }
  async replaceLocal(next: TrainOSBackup): Promise<void> { this.local = structuredClone(next) }
  async readBaseline(userId: string): Promise<TrainOSBackup | undefined> {
    const value = this.baselines.get(userId)
    return value ? structuredClone(value) : undefined
  }
  async writeBaseline(userId: string, next: TrainOSBackup): Promise<void> { this.baselines.set(userId, structuredClone(next)) }
  async recordConflicts(_userId: string, conflicts: SnapshotConflict[]): Promise<void> { this.conflicts = structuredClone(conflicts) }
  async markSynced(completedAt: string): Promise<void> { this.lastSyncAt = completedAt }
  async clearQueue(): Promise<void> { this.queued = false }
  async markQueueFailed(message: string): Promise<void> { this.queueAttempts += 1; this.lastError = message }
}

class TestRemote implements RemoteSnapshotStore {
  readonly rows = new Map<string, AccountSnapshotRow>()
  forcedCasFailures = 0

  async read(userId: string): Promise<AccountSnapshotRow | null> {
    const row = this.rows.get(userId)
    return row ? structuredClone(row) : null
  }

  async compareAndSet(userId: string, expectedUpdatedAt: string | null, next: AccountSnapshotRow): Promise<boolean> {
    if (this.forcedCasFailures > 0) { this.forcedCasFailures -= 1; return false }
    const current = this.rows.get(userId)
    if ((current?.updated_at ?? null) !== expectedUpdatedAt) return false
    this.rows.set(userId, structuredClone(next))
    return true
  }
}

const clock = () => new Date('2026-10-27T13:00:00.000Z')

describe('two-device account sync engine', () => {
  it('restores the account snapshot onto a fresh device', async () => {
    const remote = new TestRemote()
    remote.rows.set('user-a', {
      payload: backup({ profiles: [{ id: 'primary', name: 'Cloud Athlete' }] }),
      backup_version: 4,
      source_device_id: 'phone',
      updated_at: '2026-10-27T12:30:00.000Z',
    })
    const freshDevice = new TestDevice(backup())

    const result = await runAccountSync({ userId: 'user-a', deviceId: 'desktop', online: true, device: freshDevice, remote, now: clock })

    expect(result.direction).toBe('downloaded')
    expect(freshDevice.local.tables.profiles).toEqual([{ id: 'primary', name: 'Cloud Athlete' }])
    expect(freshDevice.queued).toBe(false)
    expect(freshDevice.lastSyncAt).toBeTruthy()
  })

  it('merges concurrent profile, workout, and meal edits across phone and desktop', async () => {
    const baseline = backup({ profiles: [{ id: 'primary', name: 'Athlete', bodyWeight: 190, updatedAt: '2026-10-27T12:00:00.000Z' }] })
    const remote = new TestRemote()
    remote.rows.set('user-a', { payload: baseline, backup_version: 4, source_device_id: 'seed', updated_at: '2026-10-27T12:00:00.000Z' })
    const phone = new TestDevice(backup({
      profiles: [{ id: 'primary', name: 'Jason', bodyWeight: 190, updatedAt: '2026-10-27T12:10:00.000Z' }],
      workouts: [{ id: 'workout-phone', completedAt: '2026-10-27T12:10:00.000Z' }],
    }), baseline)
    const desktop = new TestDevice(backup({
      profiles: [{ id: 'primary', name: 'Athlete', bodyWeight: 191, updatedAt: '2026-10-27T12:20:00.000Z' }],
      meals: [{ id: 'meal-desktop', loggedAt: '2026-10-27T12:20:00.000Z' }],
    }), baseline)

    await runAccountSync({ userId: 'user-a', deviceId: 'phone', online: true, device: phone, remote, now: clock })
    const merged = await runAccountSync({ userId: 'user-a', deviceId: 'desktop', online: true, device: desktop, remote, now: clock })
    await runAccountSync({ userId: 'user-a', deviceId: 'phone', online: true, device: phone, remote, now: clock })

    expect(merged.direction).toBe('merged')
    expect(desktop.local.tables.profiles[0]).toMatchObject({ name: 'Jason', bodyWeight: 191 })
    expect(desktop.local.tables.workouts).toHaveLength(1)
    expect(desktop.local.tables.meals).toHaveLength(1)
    expect(phone.local.tables.meals).toHaveLength(1)
  })

  it('keeps an offline active-workout edit queued until a later successful sync', async () => {
    const local = backup({ activeWorkout: [{ id: 'active', autosavedAt: '2026-10-27T12:05:00.000Z', sets: [{ id: 'set-1', reps: 8 }] }] })
    const device = new TestDevice(local)
    const remote = new TestRemote()

    await expect(runAccountSync({ userId: 'user-a', deviceId: 'phone', online: false, device, remote, now: clock }))
      .rejects.toThrow('queued on this device')
    expect(device.queued).toBe(true)
    expect(device.local.tables.activeWorkout).toEqual(local.tables.activeWorkout)

    await runAccountSync({ userId: 'user-a', deviceId: 'phone', online: true, device, remote, now: clock })
    expect(device.queued).toBe(false)
    expect(remote.rows.get('user-a')?.payload.tables.activeWorkout).toEqual(local.tables.activeWorkout)
  })

  it('reports overlapping active-workout edits and preserves independent set fields', async () => {
    const active = {
      id: 'active', autosavedAt: '2026-10-27T12:00:00.000Z',
      exercises: [{ id: 'exercise-1', sets: [{ id: 'set-1', weight: 180, completed: false }] }],
    }
    const baseline = backup({ activeWorkout: [active] })
    const remote = new TestRemote()
    remote.rows.set('user-a', { payload: baseline, backup_version: 4, source_device_id: 'seed', updated_at: '2026-10-27T12:00:00.000Z' })
    const phone = new TestDevice(backup({ activeWorkout: [{
      ...active, autosavedAt: '2026-10-27T12:10:00.000Z',
      exercises: [{ id: 'exercise-1', sets: [{ id: 'set-1', weight: 185, completed: false }] }],
    }] }), baseline)
    const desktop = new TestDevice(backup({ activeWorkout: [{
      ...active, autosavedAt: '2026-10-27T12:20:00.000Z',
      exercises: [{ id: 'exercise-1', sets: [{ id: 'set-1', weight: 190, reps: 8, completed: true }] }],
    }] }), baseline)

    await runAccountSync({ userId: 'user-a', deviceId: 'phone', online: true, device: phone, remote, now: clock })
    const result = await runAccountSync({ userId: 'user-a', deviceId: 'desktop', online: true, device: desktop, remote, now: clock })

    expect(result.conflicts).toHaveLength(1)
    expect(desktop.conflicts[0].fields.some((field) => field.endsWith('weight'))).toBe(true)
    expect(desktop.local.tables.activeWorkout[0]).toMatchObject({
      exercises: [{ sets: [{ weight: 190, reps: 8, completed: true }] }],
    })
  })

  it('retries optimistic writes and retains the queue after repeated contention', async () => {
    const device = new TestDevice(backup({ profiles: [{ id: 'primary', name: 'Athlete' }] }))
    const remote = new TestRemote()
    remote.forcedCasFailures = 3

    await expect(runAccountSync({ userId: 'user-a', deviceId: 'phone', online: true, device, remote, now: clock, maxAttempts: 3 }))
      .rejects.toThrow('Another device is syncing')
    expect(device.queued).toBe(true)
    expect(device.queueAttempts).toBe(1)
    expect(device.lastError).toContain('kept the local queue')
  })

  it('isolates remote snapshots by user and resets a device before changing account owners', async () => {
    const remote = new TestRemote()
    remote.rows.set('user-a', { payload: backup({ profiles: [{ id: 'primary', name: 'User A' }] }), backup_version: 4, source_device_id: 'a', updated_at: '2026-10-27T12:00:00.000Z' })
    remote.rows.set('user-b', { payload: backup({ profiles: [{ id: 'primary', name: 'User B' }] }), backup_version: 4, source_device_id: 'b', updated_at: '2026-10-27T12:00:00.000Z' })
    const deviceB = new TestDevice(backup())
    await runAccountSync({ userId: 'user-b', deviceId: 'new-device', online: true, device: deviceB, remote, now: clock })
    expect(deviceB.local.tables.profiles).toEqual([{ id: 'primary', name: 'User B' }])
    expect(deviceB.local.tables.profiles).not.toContainEqual({ id: 'primary', name: 'User A' })

    let resetCount = 0
    let savedOwner = ''
    await ensureDeviceOwner({
      currentOwner: 'user-a', nextOwner: 'user-b',
      reset: async () => { resetCount += 1 },
      saveOwner: (owner) => { savedOwner = owner },
    })
    expect(resetCount).toBe(1)
    expect(savedOwner).toBe('user-b')
  })
})
