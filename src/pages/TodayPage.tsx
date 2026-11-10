import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, Camera, ChevronRight, Dumbbell, Flame, Scale, Sparkles, Trophy, Utensils } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { calculateStreak } from '../algorithms/analytics'
import { generateAdaptiveRecommendations } from '../algorithms/adaptiveCoach'
import { getMuscleRecovery } from '../algorithms/recovery'
import { sumNutrition } from '../algorithms/nutrition'
import { MacroProgress } from '../components/nutrition/MacroProgress'
import { LoadingState } from '../components/States'
import { db } from '../db/database'
import { generateAndSaveWorkout } from '../services/generation'
import { usePageTitle } from '../hooks/usePageTitle'
import { useUIStore } from '../stores/uiStore'
import { formatMuscle } from '../utils/format'

const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }

export function TodayPage() {
  usePageTitle('Home')
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const settings = useLiveQuery(() => db.appSettings.get('primary'), [])
  const states = useLiveQuery(() => db.muscleStates.toArray(), [])
  const draft = useLiveQuery(() => db.draftWorkouts.orderBy('createdAt').last(), [])
  const activeRows = useLiveQuery(() => db.activeWorkout.toArray(), [])
  const active = activeRows?.[0]
  const workouts = useLiveQuery(() => db.workouts.orderBy('completedAt').reverse().toArray(), [])
  const latestPr = useLiveQuery(() => db.personalRecords.orderBy('achievedAt').last(), [])
  const targets = useLiveQuery(() => db.nutritionTargets.get('primary'), [])
  const meals = useLiveQuery(() => db.meals.orderBy('loggedAt').toArray(), [])
  const mealItems = useLiveQuery(() => db.mealItems.toArray(), [])
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy('loggedAt').toArray(), [])
  const [generating, setGenerating] = useState(false)
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  const todayKey = dateKey(new Date())
  const weekStart = useMemo(() => { const date = new Date(); const day = (date.getDay() + 6) % 7; date.setDate(date.getDate() - day); date.setHours(0,0,0,0); return date }, [])
  const todayMeals = useMemo(() => meals?.filter((meal) => dateKey(new Date(meal.loggedAt)) === todayKey) ?? [], [meals, todayKey])
  const todayMealIds = useMemo(() => new Set(todayMeals.map((meal) => meal.id)), [todayMeals])
  const todayItems = useMemo(() => mealItems?.filter((item) => todayMealIds.has(item.mealId)) ?? [], [mealItems, todayMealIds])
  const recovery = useMemo(() => (states ?? []).map((state) => ({ ...state, recovery: getMuscleRecovery(state, new Date(), settings?.recoveryAggressiveness ?? 'balanced') })).sort((a,b) => b.recovery - a.recovery), [settings?.recoveryAggressiveness, states])
  const recentDailyCalories = useMemo(() => lastDailyCalories(meals ?? [], mealItems ?? [], 7), [mealItems, meals])
  const recommendations = useMemo(() => {
    if (!profile || !targets || !metrics || !workouts) return []
    return generateAdaptiveRecommendations({ profile, targets, todayItems, recentDailyCalories, bodyMetrics: metrics, muscleStates: recovery, workouts })
  }, [metrics, profile, recentDailyCalories, recovery, targets, todayItems, workouts])
  useEffect(() => { if (recommendations.length > 0) void db.transaction('rw', db.adaptiveRecommendations, async () => { await db.adaptiveRecommendations.clear(); await db.adaptiveRecommendations.bulkPut(recommendations) }) }, [recommendations])
  if (!profile || !settings || !states || !activeRows || !workouts || !targets || !meals || !mealItems || !metrics) return <LoadingState />
  const totals = sumNutrition(todayItems)
  const thisWeek = workouts.filter((workout) => new Date(workout.completedAt) >= weekStart).length
  const workoutStreak = calculateStreak(workouts, profile.workoutsPerWeek)
  const nutritionStreak = consecutiveDayStreak(meals.map((meal) => new Date(meal.loggedAt)))
  const bodyWeights = metrics.filter((metric) => metric.weight !== undefined).slice(-7).map((metric) => metric.weight!)
  const currentWeight = bodyWeights.at(-1) ?? profile.bodyWeight
  const averageWeight = bodyWeights.length ? bodyWeights.reduce((sum, value) => sum + value, 0) / bodyWeights.length : currentWeight
  const previousWeight = bodyWeights.at(0) ?? currentWeight
  const recoverySnapshot = ['chest','lats','quadriceps','hamstrings','front delts'].map((muscle) => recovery.find((state) => state.muscle === muscle)).filter((state) => state !== undefined)
  const coach = recommendations[0]!
  const generate = async () => { setGenerating(true); try { await generateAndSaveWorkout(); navigate('/train') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to generate a workout.', 'error') } finally { setGenerating(false) } }
  const applyCalories = async () => { if (!coach.proposedCalories) return; await db.nutritionTargets.update('primary', { calories: coach.proposedCalories, source: 'manual', updatedAt: new Date().toISOString() }); addToast('Approved calorie target applied.', 'success') }
  return <main className="page unified-home">
    <header className="today-header"><div><p>{greeting()},</p><h1>{profile.name}</h1><span>Here’s what your plan needs today.</span></div><button className="avatar" onClick={() => navigate('/profile')} aria-label="Open profile">{profile.name.slice(0,1).toUpperCase()}</button></header>
    <section className={`coach-card priority-${coach.priority}`}><div className="coach-icon"><Sparkles/></div><div><p className="eyebrow">TrainOS Coach</p><h2>{coach.title}</h2><p>{coach.message}</p><div className="coach-actions"><button className="button primary" onClick={() => coach.proposedCalories ? void applyCalories() : navigate(coach.actionPath ?? '/progress')}>{coach.proposedCalories ? `Approve ${coach.proposedCalories} kcal` : coach.actionLabel ?? 'Review'} <ArrowRight/></button>{coach.proposedCalories && <button className="button ghost" onClick={() => navigate('/profile')}>Edit targets</button>}</div></div></section>
    <div className="home-metrics-grid">
      <section className="card home-nutrition-card"><div className="section-heading"><div><p className="eyebrow">Today’s calories</p><h2>{Math.round(totals.calories).toLocaleString()} <span>/ {targets.calories.toLocaleString()} kcal</span></h2></div><button className="text-button" onClick={() => navigate('/nutrition')}>Details <ChevronRight/></button></div><div className="calorie-bar"><span style={{ width: `${Math.min(100, totals.calories / targets.calories * 100)}%` }}/></div><div className="macro-row compact"><MacroProgress label="Protein" value={totals.protein} target={targets.protein} color="#c8ff36"/><MacroProgress label="Carbs" value={totals.carbs} target={targets.carbs} color="#80a7ff"/><MacroProgress label="Fat" value={totals.fat} target={targets.fat} color="#ffad66"/></div></section>
      <section className="card home-workout-card"><div className="section-heading"><div><p className="eyebrow">{active ? 'Workout saved' : 'Today’s workout'}</p><h2>{active?.title ?? draft?.title ?? 'Adaptive session'}</h2></div><span className="readiness-pill">{active ? 'Paused' : `${draft?.readiness ?? 100}% ready`}</span></div>{active ? <><p>Your session is safely saved with {active.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0)} completed sets.</p><div className="workout-line"><strong>{active.exercises.length}<small> exercises</small></strong><span>Continue where you left off</span></div><button className="button primary wide" onClick={() => navigate('/workout/active')}>Resume workout <ArrowRight/></button></> : draft ? <><p>{draft.focusMuscles.map(formatMuscle).join(' / ')} · based on today’s exercises</p><div className="workout-line"><strong>{draft.estimatedDuration}<small> min</small></strong><span>{draft.exercises.length} exercises</span></div><button className="button primary wide" onClick={() => navigate('/train')}>Review & start <ArrowRight/></button></> : <><p>Recovery, equipment, recent exercise use, and your schedule are ready to shape the next session.</p><button className="button primary wide" disabled={generating} onClick={() => void generate()}>{generating ? 'Building…' : 'Generate workout'} <Dumbbell/></button></>}</section>
      <section className="card recovery-snapshot"><div className="section-heading"><div><p className="eyebrow">Muscle recovery</p><h2>Readiness map</h2></div><button className="text-button" onClick={() => navigate('/progress')}>All muscles <ChevronRight/></button></div><div>{recoverySnapshot.map((state) => <span key={state.muscle}><strong>{formatMuscle(state.muscle)}</strong><i><b style={{ width: `${state.recovery}%` }}/></i><em>{state.recovery}%</em></span>)}</div></section>
      <section className="card bodyweight-card"><div className="section-heading"><div><p className="eyebrow">Bodyweight</p><h2>{currentWeight.toFixed(1)} <span>{profile.units}</span></h2></div><Scale/></div><div><span><small>7-day average</small><strong>{averageWeight.toFixed(1)} {profile.units}</strong></span><span><small>Change this week</small><strong className={currentWeight - previousWeight >= 0 ? 'positive' : 'negative'}>{currentWeight - previousWeight >= 0 ? '+' : ''}{(currentWeight - previousWeight).toFixed(1)} {profile.units}</strong></span></div><button className="button secondary wide" onClick={() => navigate('/progress')}>Log weight</button></section>
    </div>
    <section className="quick-actions"><button onClick={() => navigate('/nutrition?log=photo')}><Camera/><span><strong>Scan meal</strong><small>Review an estimate</small></span></button><button onClick={() => navigate('/nutrition?log=manual')}><Utensils/><span><strong>Log food</strong><small>Search or custom</small></span></button><button onClick={() => active ? navigate('/workout/active') : draft ? navigate('/train') : void generate()}><Dumbbell/><span><strong>{active ? 'Resume workout' : draft ? 'Review workout' : 'Build workout'}</strong><small>{active ? 'Continue saved session' : draft?.splitDay ?? 'Create today’s plan'}</small></span></button><button onClick={() => navigate('/progress')}><Scale/><span><strong>Log weight</strong><small>Update your trend</small></span></button></section>
    <section className="home-footer-stats"><span><Flame/><strong>{nutritionStreak}</strong><small>day nutrition streak</small></span><span><Dumbbell/><strong>{workoutStreak.current}</strong><small>week workout streak</small></span><span><Trophy/><strong>{latestPr ? Math.round(latestPr.value).toLocaleString() : '—'}</strong><small>{latestPr ? latestPr.type.replaceAll('_',' ') : 'next PR awaits'}</small></span><button onClick={() => navigate('/history')}><strong>{Math.min(thisWeek, profile.workoutsPerWeek)} of {profile.workoutsPerWeek}</strong><small>weekly workouts</small><ChevronRight/></button></section>
  </main>
}

function dateKey(date: Date): string { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }
function consecutiveDayStreak(dates: Date[]): number { const keys = new Set(dates.map(dateKey)); let streak = 0; const cursor = new Date(); while (keys.has(dateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1) } return streak }
function lastDailyCalories(meals: Array<{id:string;loggedAt:string}>, items: Array<{mealId:string;calories:number;quantity:number}>, days: number): number[] {
  const totals = new Map<string, number>(); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
  for (const meal of meals) if (new Date(meal.loggedAt) >= cutoff) { const key = dateKey(new Date(meal.loggedAt)); const calories = items.filter((item) => item.mealId === meal.id).reduce((sum,item) => sum + item.calories * item.quantity,0); totals.set(key,(totals.get(key)??0)+calories) }
  return [...totals.values()]
}
