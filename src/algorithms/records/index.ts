import { calculateEstimatedOneRepMax, calculateVolume } from '../strength'
import type { PersonalRecord, SetLog } from '../../types'

export type RecordCandidateSet = Pick<SetLog, 'exerciseId' | 'weight' | 'reps'>

export function detectPersonalRecords(
  workoutId: string,
  completedAt: string,
  sets: RecordCandidateSet[],
  previousSets: RecordCandidateSet[],
  previousRecords: PersonalRecord[] = [],
): PersonalRecord[] {
  const records: PersonalRecord[] = []
  const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))]
  for (const exerciseId of exerciseIds) {
    const current = sets.filter((set) => set.exerciseId === exerciseId)
    const prior = previousSets.filter((set) => set.exerciseId === exerciseId)
    const currentWeight = Math.max(...current.map((set) => set.weight), 0)
    const priorWeight = Math.max(...prior.map((set) => set.weight), 0)
    const currentReps = Math.max(...current.map((set) => set.reps), 0)
    const priorReps = Math.max(...prior.map((set) => set.reps), 0)
    const currentE1rm = Math.max(...current.map((set) => calculateEstimatedOneRepMax(set.weight, set.reps) ?? 0), 0)
    const priorE1rm = Math.max(...prior.map((set) => calculateEstimatedOneRepMax(set.weight, set.reps) ?? 0), 0)
    const currentVolume = calculateVolume(current)
    const priorSessions = previousRecords.filter((record) => record.exerciseId === exerciseId && record.type === 'exercise_volume')
    const priorVolume = Math.max(...priorSessions.map((record) => record.value), 0)
    const add = (type: PersonalRecord['type'], value: number) => records.push({
      id: crypto.randomUUID(), exerciseId, workoutId, type, value, achievedAt: completedAt,
    })
    if (currentWeight > priorWeight) add('weight', currentWeight)
    if (currentReps > priorReps) add('reps', currentReps)
    if (currentE1rm > priorE1rm) add('estimated_1rm', currentE1rm)
    if (currentVolume > priorVolume) add('exercise_volume', currentVolume)
  }
  const workoutVolume = calculateVolume(sets)
  const priorWorkoutVolume = Math.max(...previousRecords.filter((record) => record.type === 'workout_volume').map((record) => record.value), 0)
  if (workoutVolume > priorWorkoutVolume) records.push({
    id: crypto.randomUUID(), workoutId, type: 'workout_volume', value: workoutVolume, achievedAt: completedAt,
  })
  return records
}
