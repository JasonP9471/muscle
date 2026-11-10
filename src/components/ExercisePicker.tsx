import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Filter, Replace, Search, ShieldCheck, Star, X } from 'lucide-react'
import type { ExerciseSubstitutionSet } from '../algorithms/exerciseSubstitutions'
import { EXERCISES } from '../data/exercises'
import { db } from '../db/database'
import type { Exercise } from '../types'
import { MUSCLES } from '../types'
import { ExerciseGlyph } from './ExerciseGlyph'
import { formatMuscle } from '../utils/format'

export function ExercisePicker({
  open, title = 'Add exercise', excludeIds = [], substitutions, onSelect, onClose,
}: {
  open: boolean
  title?: string
  excludeIds?: string[]
  substitutions?: ExerciseSubstitutionSet | null
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}) {
  const preferenceRows = useLiveQuery(() => db.exercisePreferences.toArray(), [])
  const gym = useLiveQuery(() => db.gymProfiles.get('primary'), [])
  const recentLogs = useLiveQuery(() => db.setLogs.orderBy('completedAt').reverse().limit(80).toArray(), [])
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('all')
  const [equipment, setEquipment] = useState('all')
  const [pattern, setPattern] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const favoriteIds = useMemo(() => new Set((preferenceRows ?? []).filter((preference) => preference.level === 'favorite').map((preference) => preference.exerciseId)), [preferenceRows])
  const excluded = useMemo(() => new Set((preferenceRows ?? []).filter((preference) => preference.level === 'exclude').map((preference) => preference.exerciseId)), [preferenceRows])
  const recentIds = useMemo(() => [...new Set((recentLogs ?? []).map((log) => log.exerciseId))], [recentLogs])
  const alternativeById = useMemo(() => new Map((substitutions?.alternatives ?? []).map((alternative, index) => [alternative.exercise.id, { ...alternative, rank: index + 1 }])), [substitutions])
  const exercises = useMemo(() => {
    const term = search.toLowerCase().trim()
    return EXERCISES.filter((exercise) => !excludeIds.includes(exercise.id)
      && !excluded.has(exercise.id)
      && exercise.requiredEquipment.every((item) => gym?.equipment.includes(item) ?? true)
      && (!substitutions || alternativeById.has(exercise.id))
      && (!term || exercise.name.toLowerCase().includes(term) || exercise.aliases.some((alias) => alias.toLowerCase().includes(term)))
      && (muscle === 'all' || [...exercise.primaryMuscles, ...exercise.secondaryMuscles].some((target) => target.muscle === muscle))
      && (equipment === 'all' || exercise.requiredEquipment.includes(equipment))
      && (pattern === 'all' || exercise.movementPattern === pattern)
      && (!favoritesOnly || favoriteIds.has(exercise.id)))
      .sort((a, b) => {
        const rankedA = alternativeById.get(a.id)?.rank ?? Number.MAX_SAFE_INTEGER
        const rankedB = alternativeById.get(b.id)?.rank ?? Number.MAX_SAFE_INTEGER
        const recentA = recentIds.includes(a.id) ? 1 : 0
        const recentB = recentIds.includes(b.id) ? 1 : 0
        return rankedA - rankedB || Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)) || recentB - recentA || a.name.localeCompare(b.name)
      })
  }, [alternativeById, excludeIds, excluded, equipment, favoriteIds, favoritesOnly, gym?.equipment, muscle, pattern, recentIds, search, substitutions])
  if (!open) return null
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="picker-sheet" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <header><div><p className="eyebrow">Exercise library</p><h2 id="picker-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close exercise picker"><X /></button></header>
        {substitutions && <div className="substitution-summary">
          <Replace aria-hidden="true" />
          <div><strong>Replacing {substitutions.source.name}</strong><p>Ranked by movement pattern, target muscles, your equipment, and difficulty.</p></div>
          {substitutions.limitationLabels.length > 0 && <span><ShieldCheck /> {substitutions.limitationLabels.join(' · ')} filter active</span>}
        </div>}
        <label className="search-field"><Search /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={substitutions ? 'Search recommended substitutes' : 'Search 231 exercises'} aria-label="Search exercises" /></label>
        <div className="picker-filters">
          <Filter size={18} aria-hidden="true" />
          <select aria-label="Filter by muscle" value={muscle} onChange={(event) => setMuscle(event.target.value)}><option value="all">All muscles</option>{MUSCLES.map((item) => <option key={item} value={item}>{formatMuscle(item)}</option>)}</select>
          <select aria-label="Filter by equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)}><option value="all">All equipment</option>{gym?.equipment.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Filter by movement" value={pattern} onChange={(event) => setPattern(event.target.value)}><option value="all">All movements</option>{['horizontal_push','vertical_push','horizontal_pull','vertical_pull','squat','hinge','lunge','carry','core','isolation','cardio'].map((item) => <option key={item} value={item}>{item.replaceAll('_',' ')}</option>)}</select>
          <button className={favoritesOnly ? 'filter-active' : ''} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}><Star size={16} /> Favorites</button>
        </div>
        <div className="picker-list">
          {exercises.map((exercise) => {
            const alternative = alternativeById.get(exercise.id)
            return <button className={`picker-exercise ${alternative ? 'recommended' : ''}`} key={exercise.id} onClick={() => onSelect(exercise)}>
            <ExerciseGlyph pattern={exercise.movementPattern} />
            <span><strong>{exercise.name}</strong><small>{exercise.primaryMuscles.map((target) => formatMuscle(target.muscle)).join(' · ')} · {exercise.requiredEquipment.join(', ')}</small>{alternative && <span className="substitution-reasons"><em>#{alternative.rank} · {alternative.matchQuality}</em>{alternative.reasons.slice(0, 4).map((reason) => <i key={reason}><Check /> {reason}</i>)}</span>}</span>
            {favoriteIds.has(exercise.id) ? <Star className="favorite" /> : <Check />}
          </button>})}
          {exercises.length === 0 && <p className="picker-empty">{substitutions ? 'No substitute matches your equipment, preferences, limitations, and filters. Adjust a filter or update your profile restrictions.' : 'No compatible exercises match those filters.'}</p>}
        </div>
        {substitutions?.limitationLabels.length ? <p className="substitution-disclaimer">Limitation matching is a conservative planning filter, not medical clearance. Use a pain-free range and follow professional guidance.</p> : null}
      </section>
    </div>
  )
}
