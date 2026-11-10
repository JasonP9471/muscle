import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, CalendarCheck, Clock3, Dumbbell, Flame, Scale, TrendingUp } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calculateStreak, calculateTrainingDistribution } from '../algorithms/analytics'
import { calculateEstimatedOneRepMax } from '../algorithms/strength'
import { movingAverage, sumNutrition } from '../algorithms/nutrition'
import { BodyCheckin } from '../components/progress/BodyCheckin'
import { PageHeader } from '../components/PageHeader'
import { LoadingState } from '../components/States'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/database'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatLongDuration, formatMuscle } from '../utils/format'

const FILTERS = [{ id: '1m', label: '1M', days: 31 }, { id: '3m', label: '3M', days: 92 }, { id: '6m', label: '6M', days: 183 }, { id: '1y', label: '1Y', days: 365 }, { id: 'all', label: 'All', days: Infinity }] as const
const REFERENCE_TIME = Date.now()

export function ProgressPage() {
  usePageTitle('Progress')
  const workouts = useLiveQuery(() => db.workouts.orderBy('completedAt').toArray(), [])
  const logs = useLiveQuery(() => db.setLogs.toArray(), [])
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy('loggedAt').toArray(), [])
  const meals = useLiveQuery(() => db.meals.orderBy('loggedAt').toArray(), [])
  const mealItems = useLiveQuery(() => db.mealItems.toArray(), [])
  const [filterId, setFilterId] = useState<(typeof FILTERS)[number]['id']>('3m')
  const [strengthExercise, setStrengthExercise] = useState('')
  const selectedFilter = FILTERS.find((filter) => filter.id === filterId)!
  const filteredWorkouts = useMemo(() => workouts?.filter((workout) => selectedFilter.days === Infinity || new Date(workout.completedAt).getTime() >= REFERENCE_TIME - selectedFilter.days * 86_400_000) ?? [], [selectedFilter.days, workouts])
  const workoutIds = useMemo(() => new Set(filteredWorkouts.map((workout) => workout.id)), [filteredWorkouts])
  const filteredLogs = useMemo(() => logs?.filter((log) => workoutIds.has(log.workoutId)) ?? [], [logs, workoutIds])
  if (!workouts || !logs || !profile || !metrics || !meals || !mealItems) return <LoadingState />
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const workoutsThisWeek = workouts.filter((workout) => new Date(workout.completedAt) >= weekStart).length
  const workoutsThisMonth = workouts.filter((workout) => new Date(workout.completedAt) >= monthStart).length
  const streak = calculateStreak(workouts, profile.workoutsPerWeek)
  const totalVolume = filteredWorkouts.reduce((sum, workout) => sum + workout.totalVolume, 0)
  const totalTime = filteredWorkouts.reduce((sum, workout) => sum + workout.durationSeconds, 0)
  const weekly = new Map<string, { label: string; volume: number; workouts: number }>()
  for (const workout of filteredWorkouts) {
    const date = new Date(workout.completedAt); date.setDate(date.getDate() - ((date.getDay()+6)%7)); date.setHours(0,0,0,0)
    const key = date.toISOString().slice(0,10); const item = weekly.get(key) ?? { label: date.toLocaleDateString(undefined,{month:'short',day:'numeric'}), volume:0, workouts:0 }
    item.volume += workout.totalVolume; item.workouts += 1; weekly.set(key,item)
  }
  const weeklyData = [...weekly.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([,value]) => ({ ...value, volume: Math.round(value.volume) }))
  const distribution = calculateTrainingDistribution(filteredLogs, EXERCISE_BY_ID).filter((item) => item.sets > 0).sort((a,b) => b.sets-a.sets)
  const exerciseIds = [...new Set(logs.map((log) => log.exerciseId))]
  const selectedExerciseId = strengthExercise || exerciseIds[0] || ''
  const strengthGroups = new Map<string, typeof logs>()
  for (const log of filteredLogs.filter((set) => set.exerciseId === selectedExerciseId)) strengthGroups.set(log.workoutId,[...(strengthGroups.get(log.workoutId)??[]),log])
  const strengthData = [...strengthGroups.entries()].map(([workoutId,sets]) => ({ date: new Date(workouts.find((item)=>item.id===workoutId)?.completedAt ?? sets[0].completedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}), e1rm: Math.round(Math.max(...sets.map((set)=>calculateEstimatedOneRepMax(set.weight,set.reps)??0))) })).sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime())
  const filteredWeights = metrics.filter((metric) => metric.weight && (selectedFilter.days === Infinity || new Date(metric.loggedAt).getTime() >= REFERENCE_TIME - selectedFilter.days * 86_400_000))
  const weightAverages = movingAverage(filteredWeights.map((metric) => metric.weight!), Math.min(7, filteredWeights.length || 1))
  const bodyData = filteredWeights.map((metric, index) => ({ date: new Date(metric.loggedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}), weight: metric.weight, average: weightAverages[index] ? Number(weightAverages[index]!.toFixed(1)) : undefined }))
  const nutritionByDay = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number }>()
  for (const meal of meals) {
    if (selectedFilter.days !== Infinity && new Date(meal.loggedAt).getTime() < REFERENCE_TIME - selectedFilter.days * 86_400_000) continue
    const key = meal.loggedAt.slice(0,10); const daily = nutritionByDay.get(key) ?? { date: new Date(meal.loggedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}), calories:0,protein:0,carbs:0,fat:0 }
    const totals = sumNutrition(mealItems.filter((item) => item.mealId === meal.id)); daily.calories += totals.calories; daily.protein += totals.protein; daily.carbs += totals.carbs; daily.fat += totals.fat; nutritionByDay.set(key,daily)
  }
  const nutritionData = [...nutritionByDay.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([,value]) => ({ ...value, calories: Math.round(value.calories), protein: Math.round(value.protein), carbs: Math.round(value.carbs), fat: Math.round(value.fat) }))
  return <main className="page progress-page"><PageHeader eyebrow="Training intelligence" title="Your progress" description="Clear trends from the work you've logged—no scores made up behind a curtain." />
    <div className="time-filters" role="group" aria-label="Progress time range">{FILTERS.map((filter)=><button key={filter.id} className={filterId===filter.id?'selected':''} aria-pressed={filterId===filter.id} onClick={()=>setFilterId(filter.id)}>{filter.label}</button>)}</div>
    <section className="top-metrics"><div><CalendarCheck /><span>Workouts this week</span><strong>{workoutsThisWeek}</strong></div><div><Dumbbell /><span>Workouts this month</span><strong>{workoutsThisMonth}</strong></div><div><Flame /><span>Weekly streak</span><strong>{streak.current}<small> weeks</small></strong></div><div><Scale /><span>Training volume</span><strong>{Math.round(totalVolume).toLocaleString()}<small> {profile.units}</small></strong></div><div><Clock3 /><span>Training time</span><strong>{formatLongDuration(totalTime)}</strong></div></section>
    {filteredWorkouts.length === 0 ? <section className="empty-chart"><BarChart3 /><h2>Progress needs a little history</h2><p>Complete workouts or load demo data in Settings to bring these charts to life.</p></section> : <div className="analytics-grid">
      <section className="card chart-card wide"><div className="section-heading"><div><p className="eyebrow">Work performed</p><h2>Weekly volume</h2></div><span className="chart-total">{Math.round(totalVolume).toLocaleString()} {profile.units}</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weeklyData}><defs><linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c8ff36" stopOpacity={.35}/><stop offset="100%" stopColor="#c8ff36" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis width={50}/><Tooltip/><Area type="monotone" dataKey="volume" stroke="#c8ff36" strokeWidth={3} fill="url(#volumeGradient)"/></AreaChart></ResponsiveContainer></div></section>
      <section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Consistency</p><h2>Workout frequency</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis allowDecimals={false} width={28}/><Tooltip/><Bar dataKey="workouts" fill="#c8ff36" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Recent weekly sets</p><h2>Muscle distribution</h2></div></div><div className="chart-wrap distribution-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution.slice(0,10)} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="muscle" width={84} tickFormatter={formatMuscle}/><Tooltip/><Bar dataKey="sets" radius={[0,5,5,0]}>{distribution.slice(0,10).map((item)=><Cell key={item.muscle} fill={item.level==='higher'?'#c8ff36':item.level==='lower'?'#66717a':'#98a18b'}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="distribution-legend"><span>Lower recent volume</span><span>Balanced</span><span>Higher recent volume</span></div></section>
      <section className="card chart-card wide"><div className="section-heading"><div><p className="eyebrow">Estimated performance</p><h2>Strength progression</h2></div><select aria-label="Strength exercise" value={selectedExerciseId} onChange={(event)=>setStrengthExercise(event.target.value)}>{exerciseIds.map((id)=><option key={id} value={id}>{EXERCISE_BY_ID.get(id)?.name}</option>)}</select></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={strengthData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis width={42}/><Tooltip/><Line type="monotone" dataKey="e1rm" name={`Estimated 1RM (${profile.units})`} stroke="#c8ff36" strokeWidth={3}/></LineChart></ResponsiveContainer></div><p className="chart-note"><TrendingUp /> Estimated with Epley for sets of 15 reps or fewer.</p></section>
      {bodyData.length > 0 && <section className="card chart-card wide"><div className="section-heading"><div><p className="eyebrow">Body composition</p><h2>Body-weight trend</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={bodyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis width={42} domain={['dataMin - 2','dataMax + 2']}/><Tooltip/><Line type="monotone" dataKey="weight" name={`Daily (${profile.units})`} stroke="#80a7ff" strokeWidth={1.5} dot={false}/><Line type="monotone" dataKey="average" name={`7-day average (${profile.units})`} stroke="#c8ff36" strokeWidth={3}/></LineChart></ResponsiveContainer></div></section>}
      {nutritionData.length > 0 && <><section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Nutrition consistency</p><h2>Daily calories</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={nutritionData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis width={42}/><Tooltip/><Bar dataKey="calories" fill="#c8ff36" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></section><section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Macro averages</p><h2>Protein, carbs & fat</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={nutritionData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis width={38}/><Tooltip/><Line type="monotone" dataKey="protein" stroke="#c8ff36" strokeWidth={2}/><Line type="monotone" dataKey="carbs" stroke="#80a7ff" strokeWidth={2}/><Line type="monotone" dataKey="fat" stroke="#ffad66" strokeWidth={2}/></LineChart></ResponsiveContainer></div></section></>}
    </div>}
    <BodyCheckin profile={profile}/>
  </main>
}
