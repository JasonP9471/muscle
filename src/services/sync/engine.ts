import type { TrainOSBackup } from '../../db/backup'
import { mergeSnapshots, type SnapshotConflict } from './merge'

export type SyncDirection = 'uploaded' | 'downloaded' | 'merged' | 'unchanged'

export interface AccountSnapshotRow {
  payload: TrainOSBackup
  backup_version: number
  source_device_id: string
  updated_at: string
}

export interface DeviceSyncStore {
  queueSnapshot(reason: string): Promise<void>
  readLocal(): Promise<TrainOSBackup>
  readBaseline(userId: string): Promise<TrainOSBackup | undefined>
  acknowledge(input: SyncAcknowledgement): Promise<SyncAcknowledgementResult>
  markQueueFailed(message: string): Promise<void>
}

export interface SyncAcknowledgement {
  userId: string
  expectedLocal: TrainOSBackup
  acknowledged: TrainOSBackup
  completedAt: string
  conflicts: SnapshotConflict[]
}

export interface SyncAcknowledgementResult {
  backup: TrainOSBackup
  pending: boolean
  conflicts: SnapshotConflict[]
}

// The device must read, reconcile, and commit this result in one transaction.
export function reconcileAcknowledgement(current: TrainOSBackup, input: SyncAcknowledgement): SyncAcknowledgementResult {
  const changed = fingerprintBackup(current) !== fingerprintBackup(input.expectedLocal)
  const merged = changed
    ? mergeSnapshots(input.expectedLocal, current, input.acknowledged)
    : { backup: input.acknowledged, conflicts: [] }
  return {
    backup: merged.backup,
    pending: fingerprintBackup(merged.backup) !== fingerprintBackup(input.acknowledged),
    conflicts: [...input.conflicts, ...merged.conflicts],
  }
}

export interface RemoteSnapshotStore {
  read(userId: string): Promise<AccountSnapshotRow | null>
  compareAndSet(userId: string, expectedUpdatedAt: string | null, next: AccountSnapshotRow): Promise<boolean>
}

export interface SyncEngineSummary {
  direction: SyncDirection
  backup: TrainOSBackup
  conflicts: SnapshotConflict[]
  completedAt: string
}

export async function runAccountSync(input: {
  userId: string
  deviceId: string
  online: boolean
  device: DeviceSyncStore
  remote: RemoteSnapshotStore
  now?: () => Date
  maxAttempts?: number
}): Promise<SyncEngineSummary> {
  const now = input.now ?? (() => new Date())
  const maxAttempts = input.maxAttempts ?? 3
  await input.device.queueSnapshot('sync-requested')
  if (!input.online) {
    throw new Error('You are offline. This change is queued on this device and will sync automatically when you reconnect.')
  }

  let conflicts: SnapshotConflict[] = []
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const local = await input.device.readLocal()
    const baseline = await input.device.readBaseline(input.userId)
    const remote = await input.remote.read(input.userId)
    const result = chooseMergedSnapshot(local, remote, baseline)
    const completedAt = nextRemoteTimestamp(remote?.updated_at, now())
    const saved = await input.remote.compareAndSet(input.userId, remote?.updated_at ?? null, {
      payload: result.backup,
      backup_version: result.backup.version,
      source_device_id: input.deviceId,
      updated_at: completedAt,
    })
    if (!saved) continue

    const acknowledged = await input.device.acknowledge({
      userId: input.userId, expectedLocal: local, acknowledged: result.backup,
      completedAt, conflicts: [...conflicts, ...result.conflicts],
    })
    conflicts = acknowledged.conflicts
    if (acknowledged.pending) continue
    return { direction: result.direction, backup: acknowledged.backup, conflicts, completedAt }
  }

  const message = 'Another device changed the account while this device was syncing. TrainOS kept the local queue and will retry.'
  await input.device.markQueueFailed(message)
  throw new Error('Another device is syncing right now. Your local changes are safe and queued; try Sync now again in a moment.')
}

export function chooseMergedSnapshot(
  local: TrainOSBackup,
  remote: AccountSnapshotRow | null,
  baseline: TrainOSBackup | undefined,
): { backup: TrainOSBackup; conflicts: SnapshotConflict[]; direction: SyncDirection } {
  if (!remote) return { backup: local, conflicts: [], direction: 'uploaded' }
  const localFingerprint = fingerprintBackup(local)
  const remoteFingerprint = fingerprintBackup(remote.payload)
  if (localFingerprint === remoteFingerprint) return { backup: local, conflicts: [], direction: 'unchanged' }

  if (!baseline) {
    const hasMeaningfulLocalData = local.tables.profiles.length > 0
      || local.tables.workouts.length > 0
      || local.tables.meals.length > 0
    if (!hasMeaningfulLocalData || remote.source_device_id === 'muscle-os-import') {
      return { backup: remote.payload, conflicts: [], direction: 'downloaded' }
    }
    const merged = mergeSnapshots(emptyBaseline(local), local, remote.payload)
    return { ...merged, direction: 'merged' }
  }

  const baseFingerprint = fingerprintBackup(baseline)
  if (localFingerprint === baseFingerprint) return { backup: remote.payload, conflicts: [], direction: 'downloaded' }
  if (remoteFingerprint === baseFingerprint) return { backup: local, conflicts: [], direction: 'uploaded' }
  const merged = mergeSnapshots(baseline, local, remote.payload)
  return { ...merged, direction: 'merged' }
}

export async function ensureDeviceOwner(input: {
  currentOwner: string | null
  nextOwner: string
  reset: () => Promise<void>
  saveOwner: (userId: string) => void
}): Promise<void> {
  if (input.currentOwner && input.currentOwner !== input.nextOwner) await input.reset()
  input.saveOwner(input.nextOwner)
}

export function fingerprintBackup(backup: TrainOSBackup): string {
  const tables = { ...backup.tables }
  tables.appSettings = tables.appSettings.map((row) => {
    if (!row || typeof row !== 'object') return row
    const settings = { ...row as Record<string, unknown> }
    delete settings.lastCloudSyncAt
    return settings
  })
  const value = stableStringify({ app: backup.app, version: backup.version, tables })
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function nextRemoteTimestamp(previous: string | undefined, candidate: Date): string {
  const previousTime = previous ? Date.parse(previous) : Number.NEGATIVE_INFINITY
  const candidateTime = candidate.getTime()
  return new Date(Math.max(candidateTime, previousTime + 1)).toISOString()
}

function emptyBaseline(template: TrainOSBackup): TrainOSBackup {
  return {
    app: 'TrainOS', version: template.version, exportedAt: template.exportedAt,
    tables: Object.fromEntries(Object.keys(template.tables).map((table) => [table, []])) as unknown as TrainOSBackup['tables'],
  }
}

function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (!nestedValue || typeof nestedValue !== 'object' || Array.isArray(nestedValue)) return nestedValue
    const record = nestedValue as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]))
  })
  if (serialized === undefined) throw new Error('TrainOS could not fingerprint an empty account snapshot.')
  return serialized
}
