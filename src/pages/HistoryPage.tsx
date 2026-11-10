import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronRight, Copy, Dumbbell, History, Play, Scale, Trash2, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { EmptyState, LoadingState } from '../components/States'
import { PageHeader } from '../components/PageHeader'
import { db } from '../db/database'
import { deleteWorkout, workoutToDraft } from '../services/workouts'
import { usePageTitle } from '../hooks/usePageTitle'
import { useUIStore } from '../stores/uiStore'
import type { WorkoutRecord } from '../types'
import { formatLongDuration } from '../utils/format'

export function HistoryPage() {
  usePageTitle('Workout history')
  const workouts = useLiveQuery(() => db.workouts.orderBy('completedAt').reverse().toArray(), [])
  const exerciseRecords = useLiveQuery(() => db.workoutExercises.toArray(), [])
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const [pendingDelete, setPendingDelete] = useState<WorkoutRecord | null>(null)
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  const groups = useMemo(() => {
    const map = new Map<string, WorkoutRecord[]>()
    for (const workout of workouts ?? []) {
      const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(workout.completedAt))
      map.set(label, [...(map.get(label) ?? []), workout])
    }
    return [...map.entries()]
  }, [workouts])
  if (!workouts || !exerciseRecords || !profile) return <LoadingState />
  const repeat = async (workoutId: string, suffix = '') => { await workoutToDraft(workoutId, suffix); navigate('/train') }
  return <main className="page history-page"><PageHeader eyebrow="Your training log" title="Workout history" description="Every set, note, and personal record—stored privately on this device." />
    {workouts.length === 0 ? <EmptyState icon={History} title="Your log starts with one session" message="Complete a workout and its sets, volume, recovery impact, and records will appear here." action={<button className="button primary" onClick={() => navigate('/train')}>Plan a workout</button>} /> : <div className="history-groups">{groups.map(([label, entries]) => <section key={label}><h2>{label}</h2><div className="history-list">{entries.map((workout) => {
      const count = exerciseRecords.filter((record) => record.workoutId === workout.id).length
      return <article className="history-card-full" key={workout.id}><button className="history-main" onClick={() => navigate(`/history/${workout.id}`)}><span className="history-date"><strong>{new Date(workout.completedAt).getDate()}</strong><small>{new Date(workout.completedAt).toLocaleDateString(undefined, { weekday: 'short' })}</small></span><span className="history-info"><small>{workout.splitDay}</small><strong>{workout.title}</strong><span><Dumbbell /> {count} exercises <i /> <CalendarDays /> {formatLongDuration(workout.durationSeconds)} <i /> <Scale /> {Math.round(workout.totalVolume).toLocaleString()} {profile.units}</span></span>{workout.prCount > 0 && <em><Trophy /> {workout.prCount} PR</em>}<ChevronRight /></button><footer><button onClick={() => void repeat(workout.id)}><Play /> Repeat</button><button onClick={() => void repeat(workout.id, ' copy')}><Copy /> Duplicate</button><button className="delete-action" onClick={() => setPendingDelete(workout)}><Trash2 /> Delete</button></footer></article>
    })}</div></section>)}</div>}
    <ConfirmationDialog open={!!pendingDelete} title="Delete this workout?" message="The workout and all logged sets will be removed. Progress statistics, records, and recovery history will be recalculated." confirmLabel="Delete workout" danger onCancel={() => setPendingDelete(null)} onConfirm={async () => { if (pendingDelete) await deleteWorkout(pendingDelete.id); setPendingDelete(null); addToast('Workout deleted and stats recalculated.', 'success') }} />
  </main>
}

