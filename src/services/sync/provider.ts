import { cloudConfig } from '../../config/cloud'
import { exportAllData, importBackup, type TrainOSBackup } from '../../db/backup'
import { db, type SyncConflictRecord, type SyncMetadata, type SyncQueueEntry } from '../../db/database'
import { resetDatabase } from '../../db/initialize'
import { authProvider } from '../auth/provider'
import { supabaseClient } from '../supabase/client'
import {
  ensureDeviceOwner, fingerprintBackup, runAccountSync, type AccountSnapshotRow,
  type DeviceSyncStore, type RemoteSnapshotStore, type SyncDirection,
} from './engine'
import type { SnapshotConflict } from './merge'

export { fingerprintBackup } from './engine'
export type SyncAction = 'upload' | 'download' | 'unchanged' | 'conflict'

export interface SyncSummary {
  direction: SyncDirection
  tables: number
  rows: number
  completedAt: string
  conflicts: number
}

const OWNER_KEY = 'trainos-data-owner-v1'
const DEVICE_KEY = 'trainos-device-id-v1'
const OUTBOX_ID = 'account-snapshot'
const MAX_SYNC_ATTEMPTS = 3
let activeSync: Promise<SyncSummary> | null = null

export const cloudSyncAvailable = cloudConfig.enabled && authProvider.mode === 'supabase'

// Retained as a small pure compatibility helper for older backups and tests. New
// syncs use record-level three-way merging instead of stopping at this decision.
export function decideSyncAction(input: {
  hasMeaningfulLocalData: boolean
  localFingerprint: string
  remoteFingerprint: string
  lastSyncedFingerprint: string | null
  remoteIsExplicitImport?: boolean
}): SyncAction {
  if (input.localFingerprint === input.remoteFingerprint) return 'unchanged'
  if (!input.lastSyncedFingerprint && input.remoteIsExplicitImport) return 'download'
  if (!input.hasMeaningfulLocalData) return 'download'
  if (!input.lastSyncedFingerprint) return 'conflict'
  const localChanged = input.localFingerprint !== input.lastSyncedFingerprint
  const remoteChanged = input.remoteFingerprint !== input.lastSyncedFingerprint
  if (localChanged && remoteChanged) return 'conflict'
  if (remoteChanged) return 'download'
  if (localChanged) return 'upload'
  return 'unchanged'
}

export async function queueLocalSnapshot(reason = 'local-change'): Promise<void> {
  if (!cloudSyncAvailable) return
  const snapshot = await exportAllData()
  const fingerprint = fingerprintBackup(snapshot)
  const existing = await db.syncQueue.get(OUTBOX_ID)
  if (existing?.fingerprint === fingerprint) return
  const now = new Date().toISOString()
  const entry: SyncQueueEntry = {
    id: OUTBOX_ID,
    payload: snapshot,
    fingerprint,
    reason,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    attemptCount: 0,
  }
  await db.syncQueue.put(entry)
}

export async function syncLocalSnapshot(): Promise<SyncSummary> {
  if (activeSync) return activeSync
  activeSync = performSync().finally(() => { activeSync = null })
  return activeSync
}

export async function getPendingSyncCount(): Promise<number> {
  return db.syncQueue.count()
}

async function performSync(): Promise<SyncSummary> {
  if (!cloudSyncAvailable) throw new Error('TrainOS account sync is not configured for this build.')
  const session = await authProvider.getSession()
  if (!session || session.demo) throw new Error('Log in before syncing your private TrainOS data.')
  await prepareAccountStorage(session.user.id)
  await db.appSettings.update('primary', { cloudSyncEnabled: true })
  const result = await runAccountSync({
    userId: session.user.id,
    deviceId: getDeviceId(),
    online: navigator.onLine,
    device: deviceStore,
    remote: remoteStore,
    maxAttempts: MAX_SYNC_ATTEMPTS,
  })
  return summarize(result.direction, result.backup, result.completedAt, result.conflicts.length)
}

async function readRemoteSnapshot(userId: string): Promise<AccountSnapshotRow | null> {
  const { data, error } = await supabaseClient
    .from('account_snapshots')
    .select('payload, backup_version, source_device_id, updated_at')
    .eq('user_id', userId)
    .maybeSingle<AccountSnapshotRow>()
  if (error) {
    await markQueueFailed(error.message)
    throw new Error(`TrainOS could not read your account snapshot. ${error.message}`)
  }
  return data
}

async function saveRemoteSnapshot(
  userId: string,
  backup: TrainOSBackup,
  remote: AccountSnapshotRow | null,
  updatedAt: string,
): Promise<boolean> {
  const row = {
    user_id: userId,
    payload: backup,
    backup_version: backup.version,
    source_device_id: getDeviceId(),
    updated_at: updatedAt,
  }
  if (!remote) {
    const { error } = await supabaseClient.from('account_snapshots').insert(row)
    if (!error) return true
    if (error.code === '23505') return false
    await markQueueFailed(error.message)
    throw new Error(`TrainOS could not create your account snapshot. ${error.message}`)
  }

  const { data, error } = await supabaseClient
    .from('account_snapshots')
    .update(row)
    .eq('user_id', userId)
    .eq('updated_at', remote.updated_at)
    .select('updated_at')
  if (error) {
    await markQueueFailed(error.message)
    throw new Error(`TrainOS could not save your account snapshot. ${error.message}`)
  }
  return (data?.length ?? 0) === 1
}

const deviceStore: DeviceSyncStore = {
  queueSnapshot: queueLocalSnapshot,
  readLocal: exportAllData,
  replaceLocal: async (backup) => { await importBackup(backup) },
  readBaseline: async (userId) => (await readMetadata(userId))?.baseline,
  writeBaseline: writeMetadata,
  recordConflicts,
  markSynced: async (completedAt) => {
    await db.appSettings.update('primary', { cloudSyncEnabled: true, lastCloudSyncAt: completedAt })
  },
  clearQueue: async () => { await db.syncQueue.delete(OUTBOX_ID) },
  markQueueFailed,
}

const remoteStore: RemoteSnapshotStore = {
  read: readRemoteSnapshot,
  compareAndSet: async (userId, expectedUpdatedAt, next) => {
    const remote = expectedUpdatedAt === null ? null : { ...next, updated_at: expectedUpdatedAt }
    return saveRemoteSnapshot(userId, next.payload, remote, next.updated_at)
  },
}

async function readMetadata(userId: string): Promise<(SyncMetadata & { baseline: TrainOSBackup }) | undefined> {
  const metadata = await db.syncMetadata.get(userId)
  if (!metadata || !isBackup(metadata.baseline)) return undefined
  return { ...metadata, baseline: metadata.baseline }
}

async function writeMetadata(userId: string, baseline: TrainOSBackup, remoteUpdatedAt: string): Promise<void> {
  await db.syncMetadata.put({ id: userId, userId, baseline, remoteUpdatedAt, updatedAt: new Date().toISOString() })
}

async function recordConflicts(userId: string, conflicts: SnapshotConflict[], resolvedAt: string): Promise<void> {
  await db.syncConflicts.where('userId').equals(userId).delete()
  if (conflicts.length === 0) return
  const records: SyncConflictRecord[] = conflicts.map((conflict) => ({
    id: crypto.randomUUID(), userId, table: conflict.table, recordId: conflict.recordId,
    fields: conflict.fields, resolution: conflict.resolution, resolvedAt,
  }))
  await db.syncConflicts.bulkPut(records)
}

async function markQueueFailed(message: string): Promise<void> {
  const entry = await db.syncQueue.get(OUTBOX_ID)
  if (!entry) return
  await db.syncQueue.update(OUTBOX_ID, { attemptCount: entry.attemptCount + 1, lastError: message, updatedAt: new Date().toISOString() })
}

async function prepareAccountStorage(userId: string): Promise<void> {
  await ensureDeviceOwner({
    currentOwner: localStorage.getItem(OWNER_KEY),
    nextOwner: userId,
    reset: resetDatabase,
    saveOwner: (owner) => localStorage.setItem(OWNER_KEY, owner),
  })
}

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(DEVICE_KEY, id)
  return id
}

function isBackup(value: unknown): value is TrainOSBackup {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TrainOSBackup>
  return candidate.app === 'TrainOS' && typeof candidate.version === 'number' && !!candidate.tables
}

function summarize(direction: SyncDirection, backup: TrainOSBackup, completedAt: string, conflicts: number): SyncSummary {
  const rows = Object.values(backup.tables).reduce((total, table) => total + table.length, 0)
  return { direction, tables: Object.keys(backup.tables).length, rows, completedAt, conflicts }
}
