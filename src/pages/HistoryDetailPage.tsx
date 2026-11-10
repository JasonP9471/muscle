import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Copy, Pencil, Play, Save, Trash2, Trophy } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { ExerciseGlyph } from '../components/ExerciseGlyph'
import { LoadingState } from '../components/States'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/database'
import { deleteWorkout, recalculateDerivedData, workoutToDraft } from '../services/workouts'
import type { SetLog } from '../types'
import { formatDate, formatLongDuration, formatMuscle } from '../utils/format'
import { useUIStore } from '../stores/uiStore'

export function HistoryDetailPage() {
  const { workoutId = '' } = useParams()
  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId])
  const exerciseRecords = useLiveQuery(() => db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order'), [workoutId])
  const storedSets = useLiveQuery(() => db.setLogs.where('workoutId').equals(workoutId).toArray(), [workoutId])
  const records = useLiveQuery(() => db.personalRecords.where('workoutId').equals(workoutId).toArray(), [workoutId])
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const [editing, setEditing] = useState(false)
  const [editedSets, setEditedSets] = useState<SetLog[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  if (!workout || !exerciseRecords || !storedSets || !records || !profile) return <LoadingState />
  const sets = editedSets ?? storedSets
  const update = (id: string, field: 'weight' | 'reps' | 'rir', value: number) => setEditedSets((items) => (items ?? storedSets).map((set) => set.id === id ? { ...set, [field]: Math.max(0, value) } : set))
  const save = async () => { if (editedSets) await db.setLogs.bulkPut(editedSets); await recalculateDerivedData(); setEditing(false); setEditedSets(null); addToast('Workout updated and stats recalculated.', 'success') }
  const loadWorkout = async (suffix = '') => { await workoutToDraft(workoutId, suffix); navigate('/train') }
  return <main className="page history-detail"><button className="back-button" onClick={() => navigate('/history')}><ArrowLeft /> History</button><header className="history-detail-header"><div><p className="eyebrow">{formatDate(workout.completedAt)} · {workout.splitDay}</p><h1>{workout.title}</h1><p>{formatLongDuration(workout.durationSeconds)} · {workout.workingSets} sets · {Math.round(workout.totalVolume).toLocaleString()} {profile.units}</p></div><div>{editing ? <button className="button primary" onClick={() => void save()}><Save /> Save changes</button> : <button className="button secondary" onClick={() => { setEditedSets(storedSets); setEditing(true) }}><Pencil /> Edit workout</button>}<button className="button secondary" onClick={() => void loadWorkout()}><Play /> Repeat</button><button className="button secondary" onClick={() => void loadWorkout(' copy')}><Copy /> Duplicate</button><button className="button danger" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</button></div></header>
    {records.length > 0 && <div className="detail-prs"><Trophy /> <strong>{records.length} personal record{records.length === 1 ? '' : 's'}</strong>{records.map((record) => <span key={record.id}>{record.type.replaceAll('_',' ')} · {Math.round(record.value)}</span>)}</div>}
    <section className="history-exercise-list">{exerciseRecords.map((record) => {
      const exercise = EXERCISE_BY_ID.get(record.exerciseId)
      if (!exercise) return null
      const exerciseSets = sets.filter((set) => set.workoutExerciseId === record.id).sort((a,b) => a.setNumber - b.setNumber)
      return <article className="history-exercise-detail" key={record.id}><header><ExerciseGlyph pattern={exercise.movementPattern} /><div><h2>{exercise.name}</h2><p>{exercise.primaryMuscles.map((target) => formatMuscle(target.muscle)).join(' · ')}</p></div></header><div className="log-table"><div><span>Set</span><span>Weight ({profile.units})</span><span>Reps</span><span>RIR</span></div>{exerciseSets.map((set) => <div key={set.id}><strong>{set.setNumber}</strong>{editing ? <><input aria-label={`${exercise.name} set ${set.setNumber} weight`} type="number" value={set.weight} onChange={(event) => update(set.id,'weight',Number(event.target.value))} /><input aria-label={`${exercise.name} set ${set.setNumber} reps`} type="number" value={set.reps} onChange={(event) => update(set.id,'reps',Number(event.target.value))} /><select aria-label={`${exercise.name} set ${set.setNumber} RIR`} value={set.rir} onChange={(event) => update(set.id,'rir',Number(event.target.value))}>{[0,1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></> : <><span>{set.weight}</span><span>{set.reps}</span><span>{set.rir}</span></>}</div>)}</div>{record.notes && <p className="workout-note">“{record.notes}”</p>}</article>
    })}</section>
    <ConfirmationDialog open={confirmDelete} title="Delete this workout?" message="Every logged set will be removed and all derived progress, records, and recovery estimates will be recalculated." confirmLabel="Delete workout" danger onCancel={() => setConfirmDelete(false)} onConfirm={async () => { await deleteWorkout(workoutId); navigate('/history'); addToast('Workout deleted.', 'success') }} />
  </main>
}
