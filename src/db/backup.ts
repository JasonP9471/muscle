import { db } from './database'

const BACKUP_VERSION = 4
export const BACKUP_TABLE_NAMES = [
  'profiles', 'gymProfiles', 'exercises', 'exercisePreferences', 'workoutTemplates', 'workouts',
  'workoutExercises', 'setLogs', 'muscleStates', 'bodyMetrics', 'personalRecords', 'activeWorkout',
  'draftWorkouts', 'appSettings', 'nutritionTargets', 'foods', 'meals', 'mealItems',
  'favoriteFoods', 'savedMeals', 'savedMealItems', 'weeklyCheckins', 'progressPhotos',
  'adaptiveRecommendations',
] as const
const tableNames = BACKUP_TABLE_NAMES
const legacyRequiredTables = tableNames.slice(0, 14)

export interface TrainOSBackup {
  app: 'TrainOS'
  version: number
  exportedAt: string
  tables: Record<(typeof tableNames)[number], unknown[]>
}

export async function exportAllData(): Promise<TrainOSBackup> {
  const entries = await db.transaction('r', tableNames.map((name) => db.table(name)), () =>
    Promise.all(tableNames.map(async (name) => [name, await db.table(name).toArray()] as const)),
  )
  return {
    app: 'TrainOS',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: Object.fromEntries(entries) as TrainOSBackup['tables'],
  }
}

export function downloadBackup(backup: TrainOSBackup, prefix = 'trainos-backup'): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-${backup.exportedAt.slice(0, 10)}.json`
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function isBackup(value: unknown): value is TrainOSBackup {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TrainOSBackup>
  return candidate.app === 'TrainOS'
    && typeof candidate.version === 'number'
    && candidate.version <= BACKUP_VERSION
    && !!candidate.tables
    && legacyRequiredTables.every((name) => Array.isArray(candidate.tables?.[name]))
}

export async function importBackup(value: unknown): Promise<TrainOSBackup> {
  if (!isBackup(value)) throw new Error('This file is not a valid TrainOS backup or uses a newer unsupported schema.')
  const preImportBackup = await exportAllData()
  const backupTables = tableNames.map((name) => db.table(name))
  await db.transaction('rw', backupTables, async () => {
    for (const name of tableNames) {
      const table = db.table(name)
      await table.clear()
      const rows = value.tables[name] ?? []
      if (rows.length > 0) await table.bulkAdd(rows)
    }
  })
  return preImportBackup
}
