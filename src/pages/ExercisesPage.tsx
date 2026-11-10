import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Filter, Search, SlidersHorizontal, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { EXERCISES } from '../data/exercises'
import { db } from '../db/database'
import { usePageTitle } from '../hooks/usePageTitle'
import { MUSCLES } from '../types'
import { formatMuscle } from '../utils/format'

export function ExercisesPage() {
  usePageTitle('Exercises')
  const gym = useLiveQuery(() => db.gymProfiles.get('primary'), [])
  const preferences = useLiveQuery(() => db.exercisePreferences.toArray(), [])
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('all')
  const [equipment, setEquipment] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [movement, setMovement] = useState('all')
  const [kind, setKind] = useState('all')
  const [favorites, setFavorites] = useState(false)
  const [limit, setLimit] = useState(48)
  const navigate = useNavigate()
  const favoriteIds = useMemo(() => new Set((preferences ?? []).filter((preference) => preference.level === 'favorite').map((preference) => preference.exerciseId)), [preferences])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return EXERCISES.filter((exercise) => (!term || exercise.name.toLowerCase().includes(term) || exercise.aliases.some((alias) => alias.toLowerCase().includes(term)))
      && (muscle === 'all' || [...exercise.primaryMuscles, ...exercise.secondaryMuscles].some((target) => target.muscle === muscle))
      && (equipment === 'all' || exercise.requiredEquipment.includes(equipment))
      && (difficulty === 'all' || exercise.difficulty === difficulty)
      && (movement === 'all' || exercise.movementPattern === movement)
      && (kind === 'all' || (kind === 'compound' ? exercise.compound : !exercise.compound))
      && (!favorites || favoriteIds.has(exercise.id)))
      .sort((a, b) => Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)) || a.name.localeCompare(b.name))
  }, [difficulty, equipment, favoriteIds, favorites, kind, movement, muscle, search])
  return <main className="page exercises-page"><PageHeader eyebrow="Movement knowledge" title="Exercise library" description={`${EXERCISES.length} carefully structured movements across free weights, machines, cables, bodyweight, bands, kettlebells, and cardio.`} />
    <label className="library-search"><Search /><input value={search} onChange={(event) => { setSearch(event.target.value); setLimit(48) }} placeholder="Search exercise or alias" aria-label="Search exercise library" /><span>{filtered.length} results</span></label>
    <section className="library-filters" aria-label="Exercise filters"><Filter /><select aria-label="Muscle" value={muscle} onChange={(event) => setMuscle(event.target.value)}><option value="all">All muscles</option>{MUSCLES.map((item) => <option key={item} value={item}>{formatMuscle(item)}</option>)}</select><select aria-label="Equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)}><option value="all">All equipment</option>{gym?.equipment.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All levels</option><option>beginner</option><option>intermediate</option><option>advanced</option></select><select aria-label="Movement pattern" value={movement} onChange={(event) => setMovement(event.target.value)}><option value="all">All movements</option>{['horizontal_push','vertical_push','horizontal_pull','vertical_pull','squat','hinge','lunge','carry','core','isolation','cardio'].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Exercise type" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Compound & isolation</option><option value="compound">Compound</option><option value="isolation">Isolation</option></select><button className={favorites ? 'selected' : ''} aria-pressed={favorites} onClick={() => setFavorites((value) => !value)}><Star /> Favorites</button></section>
    <div className="exercise-library-grid">{filtered.slice(0, limit).map((exercise) => <button className="exercise-library-card" key={exercise.id} onClick={() => navigate(`/exercises/${exercise.id}`)} aria-label={`View ${exercise.name} guidance`}><span className="exercise-library-visual" aria-hidden="true"><img src={`/exercise-guides/library/${exercise.id}.webp`} alt="" loading="lazy" decoding="async" /></span><span className="exercise-tags"><i>{exercise.compound ? 'Compound' : 'Isolation'}</i><i>{exercise.difficulty}</i></span>{favoriteIds.has(exercise.id) && <Star className="favorite" />}<span className="exercise-card-body"><strong>{exercise.name}</strong><small>{exercise.primaryMuscles.map((target) => formatMuscle(target.muscle)).join(' · ')}</small><em>{exercise.requiredEquipment.join(' · ')}</em></span><ChevronRight /></button>)}</div>
    {limit < filtered.length && <button className="button secondary load-more" onClick={() => setLimit((value) => value + 48)}><SlidersHorizontal /> Show more exercises</button>}
  </main>
}
