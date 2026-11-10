import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookmarkPlus, ChevronDown, ChevronUp, Copy, Flame, Plus, Sparkles, Trash2, Type } from 'lucide-react'
import { MacroProgress } from '../components/nutrition/MacroProgress'
import { NutritionLogger } from '../components/nutrition/NutritionLogger'
import { LoadingState } from '../components/States'
import { PageHeader } from '../components/PageHeader'
import { sumNutrition } from '../algorithms/nutrition'
import { db } from '../db/database'
import { usePageTitle } from '../hooks/usePageTitle'
import { useLocation } from 'react-router-dom'
import { copyMealsBetweenDays, deleteMeal, deleteSavedMeal, logSavedMeal, saveMealAsTemplate } from '../services/nutrition'
import { useUIStore } from '../stores/uiStore'
import type { MealType } from '../types'

const GROUPS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const PORTIONS = [0.5, 1, 1.5, 2] as const

export function NutritionPage() {
  usePageTitle('Nutrition')
  const location = useLocation()
  const targets = useLiveQuery(() => db.nutritionTargets.get('primary'), [])
  const meals = useLiveQuery(() => db.meals.orderBy('loggedAt').reverse().toArray(), [])
  const items = useLiveQuery(() => db.mealItems.toArray(), [])
  const savedMeals = useLiveQuery(() => db.savedMeals.orderBy('updatedAt').reverse().toArray(), [])
  const savedMealItems = useLiveQuery(() => db.savedMealItems.toArray(), [])
  const requestedMode = new URLSearchParams(location.search).get('log')
  const [logger, setLogger] = useState<'manual' | 'text' | 'photo' | 'voice' | 'barcode' | null>(requestedMode === 'photo' || requestedMode === 'text' || requestedMode === 'voice' || requestedMode === 'barcode' ? requestedMode : requestedMode === 'manual' ? 'manual' : null)
  const [expanded, setExpanded] = useState<MealType | null>('breakfast')
  const [savedPortions, setSavedPortions] = useState<Record<string, number>>({})
  const [copyingYesterday, setCopyingYesterday] = useState(false)
  const addToast = useUIStore((state) => state.addToast)
  const today = localDateKey(new Date())
  const todayMeals = useMemo(() => meals?.filter((meal) => localDateKey(new Date(meal.loggedAt)) === today) ?? [], [meals, today])
  const yesterdayDate = useMemo(() => { const date = new Date(); date.setDate(date.getDate() - 1); return date }, [])
  const yesterdayKey = localDateKey(yesterdayDate)
  const yesterdayMeals = useMemo(() => meals?.filter((meal) => localDateKey(new Date(meal.loggedAt)) === yesterdayKey) ?? [], [meals, yesterdayKey])
  const todayMealIds = useMemo(() => new Set(todayMeals.map((meal) => meal.id)), [todayMeals])
  const todayItems = useMemo(() => items?.filter((item) => todayMealIds.has(item.mealId)) ?? [], [items, todayMealIds])
  if (!targets || !meals || !items || !savedMeals || !savedMealItems) return <LoadingState />
  const totals = sumNutrition(todayItems)
  const remaining = Math.max(0, targets.calories - totals.calories)
  const logSaved = async (id: string) => {
    const portion = savedPortions[id] ?? 1
    try { await logSavedMeal(id, portion); addToast(`Saved meal added at ${portion}×.`, 'success') }
    catch (error) { addToast(error instanceof Error ? error.message : 'Unable to add saved meal.', 'error') }
  }
  const copyYesterday = async () => {
    setCopyingYesterday(true)
    try {
      const count = await copyMealsBetweenDays(yesterdayDate, new Date())
      addToast(count > 0 ? `${count} meal${count === 1 ? '' : 's'} copied from yesterday.` : 'There are no meals to copy from yesterday.', count > 0 ? 'success' : 'error')
    } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to copy yesterday.', 'error') }
    finally { setCopyingYesterday(false) }
  }
  return <main className="page nutrition-page"><PageHeader eyebrow="Daily fuel" title="Nutrition" description="Fast logging, editable estimates, and targets that stay aligned with your training goal." />
    <section className="nutrition-hero"><div className="calorie-ring" style={{ '--calorie-progress': `${Math.min(100, totals.calories / targets.calories * 100)}%` } as React.CSSProperties}><div><strong>{Math.round(totals.calories).toLocaleString()}</strong><span>of {targets.calories.toLocaleString()} kcal</span></div></div><div className="nutrition-budget"><span className="live-kicker"><Flame /> Today's budget</span><h2>{Math.round(remaining).toLocaleString()} <small>kcal remaining</small></h2><p>{targets.source === 'calculated' ? `Estimated from your profile and goal · maintenance about ${targets.maintenanceCalories.toLocaleString()} kcal` : 'Using your manually approved nutrition targets.'}</p><div className="macro-row"><MacroProgress label="Protein" value={totals.protein} target={targets.protein} color="#c8ff36"/><MacroProgress label="Carbs" value={totals.carbs} target={targets.carbs} color="#80a7ff"/><MacroProgress label="Fat" value={totals.fat} target={targets.fat} color="#ffad66"/></div></div></section>
    <section className="nutrition-actions" aria-label="Quick meal actions"><button className="featured" onClick={() => setLogger('manual')}><Plus /><span><strong>Log food</strong><small>Favorites and local search</small></span></button><button onClick={() => void copyYesterday()} disabled={copyingYesterday || yesterdayMeals.length === 0}><Copy /><span><strong>{copyingYesterday ? 'Copying…' : 'Copy yesterday'}</strong><small>{yesterdayMeals.length > 0 ? `${yesterdayMeals.length} meal${yesterdayMeals.length === 1 ? '' : 's'} ready` : 'Nothing logged yesterday'}</small></span></button><button onClick={() => setLogger('photo')}><Sparkles /><span><strong>Scan meal</strong><small>Photo estimate</small></span></button><button onClick={() => setLogger('text')}><Type /><span><strong>Describe meal</strong><small>Type a full meal</small></span></button></section>
    {logger && <NutritionLogger initialMode={logger} onClose={() => setLogger(null)} />}
    {savedMeals.length > 0 && <section className="saved-meal-strip"><div className="section-heading"><div><p className="eyebrow">One-tap repeats</p><h2>Saved meals</h2></div><span>Choose a portion, then add</span></div><div>{savedMeals.map((meal) => {
      const portion = savedPortions[meal.id] ?? 1
      const mealItems = savedMealItems.filter((item) => item.savedMealId === meal.id)
      const mealTotal = sumNutrition(mealItems)
      return <article className="saved-meal-card" key={meal.id}><div className="saved-meal-card-head"><BookmarkPlus /><span><strong>{meal.name}</strong><small>{meal.defaultType} · {Math.round(mealTotal.calories * portion)} kcal</small></span><button aria-label={`Delete saved meal ${meal.name}`} onClick={() => void deleteSavedMeal(meal.id)}><Trash2 /></button></div><fieldset className="portion-picker compact"><legend>Portion for {meal.name}</legend>{PORTIONS.map((value) => <button type="button" className={portion === value ? 'selected' : ''} aria-pressed={portion === value} key={value} onClick={() => setSavedPortions((current) => ({ ...current, [meal.id]: value }))}>{value}×</button>)}</fieldset><button className="saved-meal-add" onClick={() => void logSaved(meal.id)}><Plus /> Add to {meal.defaultType}</button></article>
    })}</div></section>}
    <section className="meal-day"><div className="section-heading"><div><p className="eyebrow">Today</p><h2>Meal log</h2></div><span>{todayMeals.length} meal{todayMeals.length === 1 ? '' : 's'}</span></div>{GROUPS.map((group) => {
      const groupMeals = todayMeals.filter((meal) => meal.type === group)
      const groupIds = new Set(groupMeals.map((meal) => meal.id)); const groupItems = todayItems.filter((item) => groupIds.has(item.mealId)); const groupTotals = sumNutrition(groupItems)
      return <article className="meal-group" key={group}><button className="meal-group-header" onClick={() => setExpanded(expanded === group ? null : group)}><span><strong>{group}</strong><small>{groupMeals.length ? `${Math.round(groupTotals.calories)} kcal · ${Math.round(groupTotals.protein)}g protein` : 'Nothing logged yet.'}</small></span>{expanded === group ? <ChevronUp /> : <ChevronDown />}</button>{expanded === group && <div className="meal-group-body">{groupMeals.map((meal) => { const mealItems = items.filter((item) => item.mealId === meal.id); const mealTotal = sumNutrition(mealItems); return <div className="logged-meal" key={meal.id}><div><strong>{meal.name}</strong><small>{mealItems.map((item) => item.name).join(' · ')}</small><span>{Math.round(mealTotal.calories)} kcal · P {Math.round(mealTotal.protein)} · C {Math.round(mealTotal.carbs)} · F {Math.round(mealTotal.fat)}{meal.estimated ? ' · estimate' : ''}</span></div><button aria-label={`Save ${meal.name} as reusable meal`} onClick={async () => { await saveMealAsTemplate(meal.id, meal.name); addToast('Meal saved for one-tap reuse.', 'success') }}><BookmarkPlus /></button><button aria-label={`Delete ${meal.name}`} onClick={() => void deleteMeal(meal.id)}><Trash2 /></button></div>})}{groupMeals.length === 0 && <button className="empty-meal" onClick={() => setLogger('manual')}><Plus /><span><strong>Nothing logged yet.</strong><small>Add your first {group} food.</small></span></button>}</div>}</article>
    })}</section>
  </main>
}

function localDateKey(date: Date): string { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }
