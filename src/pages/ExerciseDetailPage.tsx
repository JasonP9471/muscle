import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BarChart3, Check, Dumbbell, Gauge, Hash, Info, Star, TrendingUp } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calculateNextPrescription } from '../algorithms/progression'
import { getExerciseGuidance } from '../algorithms/exerciseGuidance'
import { calculateEstimatedOneRepMax, calculateVolume } from '../algorithms/strength'
import { EmptyState, LoadingState } from '../components/States'
import { REP_RANGES } from '../config/training'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/database'
import { usePageTitle } from '../hooks/usePageTitle'
import type { ExercisePreferenceLevel } from '../types'
import { formatDate, formatMuscle } from '../utils/format'
import { useUIStore } from '../stores/uiStore'

const preferenceOptions: Array<{ value: ExercisePreferenceLevel; label: string }> = [
  { value: 'favorite', label: 'Favorite' }, { value: 'more', label: 'Recommend more' }, { value: 'neutral', label: 'Neutral' }, { value: 'less', label: 'Recommend less' }, { value: 'exclude', label: 'Exclude' },
]

export function ExerciseDetailPage() {
  const { exerciseId = '' } = useParams()
  const exercise = EXERCISE_BY_ID.get(exerciseId)
  usePageTitle(exercise?.name ?? 'Exercise')
  const logs = useLiveQuery(() => db.setLogs.where('exerciseId').equals(exerciseId).toArray(), [exerciseId])
  const preference = useLiveQuery(() => db.exercisePreferences.get(exerciseId), [exerciseId])
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  const sessions = useMemo(() => {
    const map = new Map<string, NonNullable<typeof logs>>()
    for (const log of logs ?? []) map.set(log.workoutId, [...(map.get(log.workoutId) ?? []), log])
    return [...map.entries()].map(([workoutId, sets]) => ({ workoutId, sets, workout: workouts?.find((item) => item.id === workoutId) })).filter((item) => item.workout).sort((a,b) => b.workout!.completedAt.localeCompare(a.workout!.completedAt))
  }, [logs, workouts])
  if (!exercise) return <EmptyState title="Exercise not found" message="This exercise is not available in the local catalog." action={<button className="button primary" onClick={() => navigate('/exercises')}>Back to library</button>} />
  if (!logs || !workouts || !profile) return <LoadingState />
  const mostRecent = sessions[0]
  const guidance = getExerciseGuidance(exercise)
  const progression = calculateNextPrescription({ exercise, previousSets: mostRecent?.sets ?? [], targetRepRange: exercise.compound ? REP_RANGES[profile.goal].compound : REP_RANGES[profile.goal].isolation, units: profile.units })
  const bestWeight = Math.max(...logs.map((set) => set.weight), 0)
  const bestReps = Math.max(...logs.map((set) => set.reps), 0)
  const bestE1rm = Math.max(...logs.map((set) => calculateEstimatedOneRepMax(set.weight, set.reps) ?? 0), 0)
  const bestVolume = Math.max(...sessions.map((session) => calculateVolume(session.sets)), 0)
  const chartData = [...sessions].reverse().map((session) => ({ date: new Date(session.workout!.completedAt).toLocaleDateString(undefined, { month:'short', day:'numeric' }), e1rm: Math.max(...session.sets.map((set) => calculateEstimatedOneRepMax(set.weight,set.reps) ?? 0)), volume: calculateVolume(session.sets), weight: Math.max(...session.sets.map((set) => set.weight)) }))
  const savePreference = async (level: ExercisePreferenceLevel) => { await db.exercisePreferences.put({ exerciseId, level, updatedAt: new Date().toISOString() }); addToast(`${exercise.name} preference saved.`, 'success') }
  return <main className="page exercise-detail-page"><button className="back-button" onClick={() => navigate('/exercises')}><ArrowLeft /> Exercise library</button>
    <section className="exercise-detail-hero"><figure className="exercise-detail-visual"><img src={`/exercise-guides/library/${exercise.id}.webp`} alt={`${exercise.name} start and finish positions`} /><figcaption aria-hidden="true"><span>Start</span><span>Finish</span></figcaption></figure><div><p className="eyebrow">{exercise.compound ? 'Compound' : 'Isolation'} · {exercise.difficulty}</p><h1>{exercise.name}</h1><p>{exercise.primaryMuscles.map((target) => formatMuscle(target.muscle)).join(' · ')} <span>with</span> {exercise.requiredEquipment.join(', ')}</p></div>{preference?.level === 'favorite' && <Star className="favorite" />}</section>
    <div className="preference-control" role="group" aria-label="Exercise preference">{preferenceOptions.map((option) => <button key={option.value} className={(preference?.level ?? 'neutral') === option.value ? 'selected' : ''} onClick={() => void savePreference(option.value)}>{option.value === 'favorite' && <Star />}{option.value === 'exclude' && <Info />}{option.label}</button>)}</div>
    <section className="instruction-grid"><article className="card"><p className="eyebrow">Technique</p><h2>Set up and execute</h2><ol>{[...guidance.setup, ...guidance.execution].map((instruction, index) => <li key={instruction}><span>{index + 1}</span>{instruction}</li>)}</ol></article><article className="card"><p className="eyebrow">Form cues</p><h2>Make each rep count</h2><ul>{exercise.formTips.map((tip) => <li key={tip}><Check />{tip}</li>)}</ul><div className="common-mistakes"><strong>Common mistakes</strong><ul>{guidance.commonMistakes.map((mistake) => <li key={mistake}><Info />{mistake}</li>)}</ul></div><div className="muscle-contributions"><strong>Secondary muscles</strong><span>{exercise.secondaryMuscles.map((target) => formatMuscle(target.muscle)).join(' · ') || 'None'}</span></div></article></section>
    <section className="rep-guidance-grid" aria-label="Rep guidance"><article><span>Tempo</span><strong>{guidance.tempo}</strong></article><article><span>Breathing</span><strong>{guidance.breathing}</strong></article><article><span>Adjust it</span><strong>{guidance.adjustment}</strong></article></section>
    <p className="exercise-safety-note"><Info />{guidance.safetyNote}</p>
    <section className="next-prescription"><TrendingUp /><div><p className="eyebrow">Next recommendation</p><h2>{progression.weight ? `${progression.weight} ${profile.units} × ${progression.targetReps}` : `${progression.targetReps} controlled reps`}</h2><p>{progression.reason}</p></div></section>
    <div className="detail-stat-grid four"><div className="stat-card"><Gauge /><span>Estimated 1RM</span><strong>{bestE1rm ? `${Math.round(bestE1rm)} ${profile.units}` : '—'}</strong><small>Estimated, up to 15 reps</small></div><div className="stat-card"><Dumbbell /><span>Best weight</span><strong>{bestWeight ? `${bestWeight} ${profile.units}` : '—'}</strong></div><div className="stat-card"><Hash /><span>Best reps</span><strong>{bestReps || '—'}</strong></div><div className="stat-card"><BarChart3 /><span>Best volume</span><strong>{bestVolume ? Math.round(bestVolume).toLocaleString() : '—'}</strong></div></div>
    {chartData.length > 0 && <section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Performance trend</p><h2>Estimated strength</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis width={42} /><Tooltip /><Line type="monotone" dataKey="e1rm" name={`Estimated 1RM (${profile.units})`} stroke="#c8ff36" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></section>}
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Training log</p><h2>{sessions.length} session{sessions.length === 1 ? '' : 's'}</h2></div></div>{sessions.length > 0 ? <div className="exercise-session-list">{sessions.map((session) => <button key={session.workoutId} onClick={() => navigate(`/history/${session.workoutId}`)}><span><strong>{formatDate(session.workout!.completedAt)}</strong><small>{session.sets.map((set) => `${set.weight}×${set.reps}`).join(' · ')}</small></span><b>{Math.round(calculateVolume(session.sets)).toLocaleString()} vol</b></button>)}</div> : <p className="muted-copy">Complete this movement in a workout to build its performance history.</p>}</section>
  </main>
}
