import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CheckCircle2, Clock3, Dumbbell, Hash, Scale, Trophy } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/database'
import { saveWorkoutFeedback } from '../services/workouts'
import { formatLongDuration, formatMuscle } from '../utils/format'
import { LoadingState } from '../components/States'
import type { WorkoutRecord } from '../types'

export function WorkoutCompletePage() {
  const { workoutId = '' } = useParams()
  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId])
  const exercises = useLiveQuery(() => db.workoutExercises.where('workoutId').equals(workoutId).toArray(), [workoutId])
  const records = useLiveQuery(() => db.personalRecords.where('workoutId').equals(workoutId).toArray(), [workoutId])
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const [feeling, setFeeling] = useState<WorkoutRecord['feeling']>()
  const [rpe, setRpe] = useState(7)
  const navigate = useNavigate()
  if (!workout || !exercises || !records || !profile) return <LoadingState />
  const submitFeedback = async (value: NonNullable<WorkoutRecord['feeling']>) => { setFeeling(value); await saveWorkoutFeedback(workoutId, value, rpe) }
  return <main className="complete-page">
    <section className="complete-hero"><span className="complete-check"><CheckCircle2 /></span><p className="eyebrow">Workout complete</p><h1>Session logged.</h1><p>{workout.title} is in the books. Your recovery estimates and next recommendations are already updated.</p></section>
    <section className="summary-card"><header><div><span>{workout.splitDay}</span><h2>{workout.title}</h2></div><small>{new Date(workout.completedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</small></header><div className="summary-metrics"><div><Clock3 /><strong>{formatLongDuration(workout.durationSeconds)}</strong><span>Duration</span></div><div><Dumbbell /><strong>{exercises.length}</strong><span>Exercises</span></div><div><Hash /><strong>{workout.workingSets}</strong><span>Working sets</span></div><div><Scale /><strong>{Math.round(workout.totalVolume).toLocaleString()} {profile.units}</strong><span>Volume</span></div></div><div className="focus-list">{workout.focusMuscles.map((muscle) => <span key={muscle}>{formatMuscle(muscle)}</span>)}</div></section>
    {records.length > 0 && <section className="pr-summary"><Trophy /><div><p className="eyebrow">New personal records</p><h2>{records.length} new best{records.length === 1 ? '' : 's'}</h2><p>Quiet progress, recorded for next time.</p></div><div className="pr-pills">{records.slice(0, 4).map((record) => <span key={record.id}>{record.type.replaceAll('_', ' ')} · {Math.round(record.value).toLocaleString()}</span>)}</div></section>}
    <section className="feedback-card"><p className="eyebrow">Quick feedback</p><h2>How did this workout feel?</h2><div className="feeling-options">{(['easy','good','hard','too_hard'] as const).map((option) => <button className={feeling === option ? 'selected' : ''} key={option} onClick={() => void submitFeedback(option)}>{option.replace('_', ' ')}</button>)}</div><label className="rpe-field"><span>Session RPE <strong>{rpe}/10</strong></span><input type="range" min="1" max="10" value={rpe} onChange={(event) => setRpe(Number(event.target.value))} onMouseUp={() => feeling && void saveWorkoutFeedback(workoutId, feeling, rpe)} /></label><p>This adds a small signal to future programming; one rating never causes a dramatic change.</p></section>
    <div className="complete-actions"><button className="button secondary" onClick={() => navigate(`/history/${workoutId}`)}>View details</button><button className="button primary" onClick={() => navigate('/today')}>Back to Today <ArrowRight /></button></div>
  </main>
}

