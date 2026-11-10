import { BACKUP_TABLE_NAMES, type TrainOSBackup } from '../../db/backup'
import type { ActiveWorkout } from '../../types'

export interface SnapshotConflict {
  table: string
  recordId: string
  fields: string[]
  resolution: 'merged_fields' | 'kept_local' | 'kept_remote' | 'kept_existing'
}

export interface SnapshotMergeResult {
  backup: TrainOSBackup
  conflicts: SnapshotConflict[]
}

type JsonRecord = Record<string, unknown>

const PRIMARY_KEYS: Partial<Record<(typeof BACKUP_TABLE_NAMES)[number], string>> = {
  muscleStates: 'muscle',
  exercisePreferences: 'exerciseId',
}

const TIMESTAMP_FIELDS = [
  'updatedAt', 'autosavedAt', 'completedAt', 'loggedAt', 'achievedAt', 'createdAt',
  'lastUpdatedAt', 'startedAt', 'effectiveFrom',
] as const

export function mergeSnapshots(
  baseline: TrainOSBackup,
  local: TrainOSBackup,
  remote: TrainOSBackup,
): SnapshotMergeResult {
  const conflicts: SnapshotConflict[] = []
  const tables = Object.fromEntries(BACKUP_TABLE_NAMES.map((table) => {
    const key = PRIMARY_KEYS[table] ?? 'id'
    const baseRows = indexRows(baseline.tables[table], key)
    const localRows = indexRows(local.tables[table], key)
    const remoteRows = indexRows(remote.tables[table], key)
    const ids = [...new Set([...baseRows.keys(), ...localRows.keys(), ...remoteRows.keys()])].sort()
    const mergedRows = ids.flatMap((recordId) => {
      const base = baseRows.get(recordId)
      const localRow = localRows.get(recordId)
      const remoteRow = remoteRows.get(recordId)
      const result = mergeRecord(table, recordId, base, localRow, remoteRow)
      if (result.conflict) conflicts.push(result.conflict)
      return result.value === undefined ? [] : [result.value]
    })
    return [table, sortRows(mergedRows)]
  })) as TrainOSBackup['tables']

  return {
    backup: { app: 'TrainOS', version: Math.max(local.version, remote.version), exportedAt: new Date().toISOString(), tables },
    conflicts,
  }
}

export function mergeActiveWorkout(
  baseline: ActiveWorkout,
  incoming: ActiveWorkout,
  stored: ActiveWorkout,
): ActiveWorkout {
  const result = mergeValue(baseline, incoming, stored, [], timestampSide(incoming, stored))
  return result.value as ActiveWorkout
}

function mergeRecord(
  table: string,
  recordId: string,
  baseline: JsonRecord | undefined,
  local: JsonRecord | undefined,
  remote: JsonRecord | undefined,
): { value?: JsonRecord; conflict?: SnapshotConflict } {
  if (equal(local, remote)) return { value: local }
  if (equal(local, baseline)) return { value: remote }
  if (equal(remote, baseline)) return { value: local }

  if (local === undefined || remote === undefined) {
    const existing = local ?? remote
    return {
      value: existing,
      conflict: existing ? { table, recordId, fields: ['deleted'], resolution: 'kept_existing' } : undefined,
    }
  }

  const preferred = timestampSide(local, remote)
  const result = mergeValue(baseline, local, remote, [], preferred)
  if (result.conflictFields.length === 0) return { value: result.value as JsonRecord }
  return {
    value: result.value as JsonRecord,
    conflict: {
      table,
      recordId,
      fields: [...new Set(result.conflictFields)].sort(),
      resolution: result.mergedCleanFields ? 'merged_fields' : preferred === 'local' ? 'kept_local' : 'kept_remote',
    },
  }
}

function mergeValue(
  baseline: unknown,
  local: unknown,
  remote: unknown,
  path: string[],
  preferred: 'local' | 'remote',
): { value: unknown; conflictFields: string[]; mergedCleanFields: boolean } {
  if (equal(local, remote)) return { value: local, conflictFields: [], mergedCleanFields: false }
  if (equal(local, baseline)) return { value: remote, conflictFields: [], mergedCleanFields: true }
  if (equal(remote, baseline)) return { value: local, conflictFields: [], mergedCleanFields: true }

  const field = path.at(-1)
  if (field && TIMESTAMP_FIELDS.some((candidate) => candidate === field) && typeof local === 'string' && typeof remote === 'string') {
    return { value: Date.parse(local) >= Date.parse(remote) ? local : remote, conflictFields: [], mergedCleanFields: true }
  }

  if (isRecord(local) && isRecord(remote)) {
    const baseRecord = isRecord(baseline) ? baseline : {}
    const keys = [...new Set([...Object.keys(baseRecord), ...Object.keys(local), ...Object.keys(remote)])].sort()
    const output: JsonRecord = {}
    const conflictFields: string[] = []
    let mergedCleanFields = false
    for (const key of keys) {
      const result = mergeValue(baseRecord[key], local[key], remote[key], [...path, key], preferred)
      if (result.value !== undefined) output[key] = result.value
      conflictFields.push(...result.conflictFields)
      mergedCleanFields ||= result.mergedCleanFields
    }
    return { value: output, conflictFields, mergedCleanFields }
  }

  if (isIdCollection(local) && isIdCollection(remote)) {
    const baseRows = isIdCollection(baseline) ? indexCollection(baseline) : new Map<string, JsonRecord>()
    const localRows = indexCollection(local)
    const remoteRows = indexCollection(remote)
    const ids = [...new Set([...baseRows.keys(), ...localRows.keys(), ...remoteRows.keys()])].sort()
    const values: JsonRecord[] = []
    const conflictFields: string[] = []
    let mergedCleanFields = false
    for (const id of ids) {
      const result = mergeValue(baseRows.get(id), localRows.get(id), remoteRows.get(id), [...path, id], preferred)
      if (isRecord(result.value)) values.push(result.value)
      conflictFields.push(...result.conflictFields)
      mergedCleanFields ||= result.mergedCleanFields
    }
    return { value: sortRows(values), conflictFields, mergedCleanFields }
  }

  return {
    value: preferred === 'local' ? local : remote,
    conflictFields: [path.join('.') || 'record'],
    mergedCleanFields: false,
  }
}

function indexRows(rows: unknown[], key: string): Map<string, JsonRecord> {
  const result = new Map<string, JsonRecord>()
  for (const row of rows) {
    if (!isRecord(row)) continue
    const value = row[key]
    if (typeof value === 'string' || typeof value === 'number') result.set(String(value), row)
  }
  return result
}

function indexCollection(rows: JsonRecord[]): Map<string, JsonRecord> {
  return new Map(rows.map((row) => [String(row.id), row]))
}

function isIdCollection(value: unknown): value is JsonRecord[] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && (typeof entry.id === 'string' || typeof entry.id === 'number'))
}

function sortRows(rows: JsonRecord[]): JsonRecord[] {
  return [...rows].sort((first, second) => {
    const firstOrder = numericOrder(first)
    const secondOrder = numericOrder(second)
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
    return String(first.id ?? first.muscle ?? first.exerciseId ?? '').localeCompare(String(second.id ?? second.muscle ?? second.exerciseId ?? ''))
  })
}

function numericOrder(row: JsonRecord): number {
  const value = row.order ?? row.setNumber
  return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER
}

function timestampSide(local: object, remote: object): 'local' | 'remote' {
  const localTimestamp = recordTimestamp(local)
  const remoteTimestamp = recordTimestamp(remote)
  if (localTimestamp !== remoteTimestamp) return localTimestamp > remoteTimestamp ? 'local' : 'remote'
  return stableStringify(local) >= stableStringify(remote) ? 'local' : 'remote'
}

function recordTimestamp(value: object): number {
  const record = value as JsonRecord
  for (const key of TIMESTAMP_FIELDS) {
    const value = record[key]
    if (typeof value !== 'string') continue
    const timestamp = Date.parse(value)
    if (Number.isFinite(timestamp)) return timestamp
  }
  return 0
}

function equal(first: unknown, second: unknown): boolean {
  return stableStringify(first) === stableStringify(second)
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  const serialized = JSON.stringify(value, (_key, nested: unknown) => {
    if (!isRecord(nested)) return nested
    return Object.fromEntries(Object.keys(nested).sort().map((key) => [key, nested[key]]))
  })
  return serialized ?? 'undefined'
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
