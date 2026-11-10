import { MUSCLES } from '../../types'
import type { Exercise, Muscle, SetLog, WorkoutRecord } from '../../types'

export function calculateTrainingDistribution(
  sets: SetLog[],
  exerciseMap: Map<string, Exercise>,
): Array<{ muscle: Muscle; sets: number; level: 'lower' | 'balanced' | 'higher' }> {
  const totals = new Map<Muscle, number>(MUSCLES.map((muscle) => [muscle, 0]))
  for (const set of sets) {
    const exercise = exerciseMap.get(set.exerciseId)
    for (const target of exercise?.primaryMuscles ?? []) totals.set(target.muscle, (totals.get(target.muscle) ?? 0) + 1)
    for (const target of exercise?.secondaryMuscles ?? []) totals.set(target.muscle, (totals.get(target.muscle) ?? 0) + 0.5)
  }
  const active = [...totals.values()].filter((value) => value > 0)
  const average = active.reduce((sum, value) => sum + value, 0) / Math.max(1, active.length)
  return MUSCLES.map((muscle) => {
    const count = Math.round((totals.get(muscle) ?? 0) * 10) / 10
    return { muscle, sets: count, level: count < average * 0.65 ? 'lower' : count > average * 1.4 ? 'higher' : 'balanced' }
  })
}

const startOfWeek = (date: Date): Date => {
  const result = new Date(date)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}

export function calculateStreak(workouts: WorkoutRecord[], weeklyTarget: number, now = new Date()): { current: number; longest: number } {
  if (weeklyTarget <= 0) return { current: 0, longest: 0 }
  const counts = new Map<number, number>()
  for (const workout of workouts) {
    const week = startOfWeek(new Date(workout.completedAt)).getTime()
    counts.set(week, (counts.get(week) ?? 0) + 1)
  }
  const successful = [...counts.entries()].filter(([, count]) => count >= weeklyTarget).map(([week]) => week).sort((a, b) => b - a)
  let longest = 0
  let run = 0
  let previous: number | undefined
  for (const week of [...successful].sort((a, b) => a - b)) {
    run = previous !== undefined && Math.round((week - previous) / 604_800_000) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = week
  }
  const currentWeek = startOfWeek(now).getTime()
  let current = 0
  let cursor = counts.get(currentWeek) && counts.get(currentWeek)! >= weeklyTarget ? currentWeek : currentWeek - 604_800_000
  while ((counts.get(cursor) ?? 0) >= weeklyTarget) {
    current += 1
    cursor -= 604_800_000
  }
  return { current, longest }
}

