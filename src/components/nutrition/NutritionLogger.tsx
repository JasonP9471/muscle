import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Barcode, Camera, Check, Mic, Plus, Search, Sparkles, Star, Type, X } from 'lucide-react'
import { db } from '../../db/database'
import { analyzeNutritionPhoto, analyzeNutritionText, getNutritionAnalysisAvailability } from '../../services/aiNutrition'
import { lookupBarcode } from '../../services/foodDatabase'
import { saveAnalysis, saveMeal, type MealDraftItem } from '../../services/nutrition'
import { chooseNativePhoto, isNativeApp, takeNativePhoto } from '../../services/mobile'
import { useUIStore } from '../../stores/uiStore'
import type { Food, MealType, NutritionAnalysis, NutritionLogMethod } from '../../types'

type LoggerMode = 'manual' | 'text' | 'photo' | 'voice' | 'barcode'

const METHODS: Array<{ id: LoggerMode; label: string; icon: typeof Plus }> = [
  { id: 'manual', label: 'Log food', icon: Plus },
  { id: 'photo', label: 'Scan meal', icon: Camera },
  { id: 'text', label: 'Describe', icon: Type },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'barcode', label: 'Barcode', icon: Barcode },
]

const EMPTY_ITEM: MealDraftItem = { name: '', servingLabel: '1 serving', quantity: 1, calories: 0, protein: 0, carbs: 0, fat: 0 }
const PORTIONS = [0.5, 1, 1.5, 2] as const

export function NutritionLogger({ initialMode = 'manual', onClose, onSaved }: { initialMode?: LoggerMode; onClose: () => void; onSaved?: () => void }) {
  const foodRows = useLiveQuery(() => db.foods.orderBy('name').toArray(), [])
  const favoriteRows = useLiveQuery(() => db.favoriteFoods.toArray(), [])
  const foods = useMemo(() => foodRows ?? [], [foodRows])
  const favorites = useMemo(() => favoriteRows ?? [], [favoriteRows])
  const [mode, setMode] = useState<LoggerMode>(initialMode)
  const [mealType, setMealType] = useState<MealType>(mealTypeForNow())
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<MealDraftItem>(EMPTY_ITEM)
  const [description, setDescription] = useState('')
  const [barcode, setBarcode] = useState('')
  const [portion, setPortionValue] = useState<number>(1)
  const [analysis, setAnalysis] = useState<NutritionAnalysis | null>(null)
  const [photoAvailability, setPhotoAvailability] = useState<{ state: 'unknown' | 'checking' | 'available' | 'unavailable'; message: string }>({ state: 'unknown', message: '' })
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const imageInput = useRef<HTMLInputElement>(null)
  const barcodeImageInput = useRef<HTMLInputElement>(null)
  const addToast = useUIStore((state) => state.addToast)
  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.foodId)), [favorites])
  const favoriteFoods = useMemo(() => {
    const byId = new Map(foods.map((food) => [food.id, food]))
    return favorites.map((favorite) => byId.get(favorite.foodId)).filter((food): food is Food => Boolean(food))
  }, [favorites, foods])
  const results = foods.filter((food) => `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8)

  useEffect(() => {
    if (mode !== 'photo' || photoAvailability.state !== 'unknown') return
    let active = true
    void getNutritionAnalysisAvailability().then((status) => {
      if (active) setPhotoAvailability({ state: status.available ? 'available' : 'unavailable', message: status.message })
    })
    return () => { active = false }
  }, [mode, photoAvailability.state])

  const selectFood = (food: Food) => setDraft({ foodId: food.id, name: food.name, servingLabel: food.servingLabel, quantity: portion, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat })
  const setPortion = (next: number) => {
    setPortionValue(next)
    setDraft((current) => current.name ? { ...current, quantity: next } : current)
  }
  const saveManual = async (method: NutritionLogMethod = 'manual') => {
    setBusy(true)
    try {
      await saveMeal({ name: draft.name, type: mealType, method, items: [draft], estimated: method !== 'manual' && method !== 'barcode' })
      if (!draft.foodId) await db.foods.put({ id: crypto.randomUUID(), name: draft.name, servingLabel: draft.servingLabel, calories: draft.calories, protein: draft.protein, carbs: draft.carbs, fat: draft.fat, source: method === 'barcode' ? 'barcode' : 'custom', createdAt: new Date().toISOString() })
      addToast('Meal added. Dashboard totals are updated.', 'success'); onSaved?.(); onClose()
    } catch (error) { addToast(message(error), 'error') } finally { setBusy(false) }
  }
  const analyzeText = async (method: 'text' | 'voice') => {
    setBusy(true)
    try { setAnalysis(await analyzeNutritionText(description)); setMode(method) }
    catch (error) { addToast(message(error), 'error') } finally { setBusy(false) }
  }
  const analyzePhoto = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try { setAnalysis(await analyzeNutritionPhoto(file, description)); setMode('photo') }
    catch (error) { addToast(message(error), 'error') } finally { setBusy(false); if (imageInput.current) imageInput.current.value = '' }
  }
  const openNativePhoto = async (source: 'camera' | 'gallery') => {
    try {
      const file = source === 'camera' ? await takeNativePhoto('meal') : await chooseNativePhoto('meal')
      if (file) await analyzePhoto(file)
    } catch (error) { addToast(message(error), 'error') }
  }
  const saveReviewedAnalysis = async () => {
    if (!analysis) return
    setBusy(true)
    try { await saveAnalysis(analysis, mealType, mode === 'voice' ? 'voice' : mode === 'photo' ? 'photo' : 'text'); addToast('Reviewed estimate saved.', 'success'); onSaved?.(); onClose() }
    catch (error) { addToast(message(error), 'error') } finally { setBusy(false) }
  }
  const scanBarcode = async () => {
    setBusy(true)
    try { const food = await lookupBarcode(barcode); selectFood(food); setMode('manual'); addToast('Product found. Review the serving before saving.', 'success') }
    catch (error) { addToast(message(error), 'error') } finally { setBusy(false) }
  }
  const scanBarcodeImage = async (file?: File) => {
    if (!file) return
    if (!window.BarcodeDetector) {
      addToast('Camera barcode detection is not supported in this browser. Enter the printed digits instead.', 'error')
      return
    }
    setBusy(true)
    try {
      const bitmap = await createImageBitmap(file)
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      const matches = await detector.detect(bitmap)
      bitmap.close()
      const detected = matches[0]?.rawValue.replace(/\D/g, '')
      if (!detected) throw new Error('No UPC or EAN barcode was found. Try a clearer image or enter the digits.')
      setBarcode(detected)
      const food = await lookupBarcode(detected)
      selectFood(food)
      setMode('manual')
      addToast('Barcode detected. Review the serving before saving.', 'success')
    } catch (error) { addToast(message(error), 'error') }
    finally {
      setBusy(false)
      if (barcodeImageInput.current) barcodeImageInput.current.value = ''
    }
  }
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognition) { addToast('Live transcription is not supported here. Type the transcript below and analyze it.', 'error'); return }
    const recognition = new SpeechRecognition(); recognition.lang = 'en-US'; recognition.interimResults = false
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => { setListening(false); addToast('Voice transcription stopped. You can type the meal instead.', 'error') }
    recognition.onresult = (event) => setDescription(event.results[0]?.[0]?.transcript ?? '')
    recognition.start()
  }
  const toggleFavorite = async (food: Food) => {
    const existing = favorites.find((favorite) => favorite.foodId === food.id)
    if (existing) await db.favoriteFoods.delete(existing.id)
    else await db.favoriteFoods.put({ id: crypto.randomUUID(), foodId: food.id, createdAt: new Date().toISOString() })
  }
  const quickAddFavorite = async (food: Food) => {
    setBusy(true)
    try {
      await saveMeal({
        name: food.name, type: mealType, method: 'manual',
        items: [{ foodId: food.id, name: food.name, servingLabel: food.servingLabel, quantity: portion, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat }],
      })
      addToast(`${food.name} added at ${portion}×.`, 'success'); onSaved?.(); onClose()
    } catch (error) { addToast(message(error), 'error') } finally { setBusy(false) }
  }

  return <section className="logger-sheet" aria-labelledby="logger-title">
    <header><div><p className="eyebrow">Fast nutrition capture</p><h2 id="logger-title">Add to today</h2></div><button className="icon-button" onClick={onClose} aria-label="Close meal logger"><X /></button></header>
    <div className="logger-methods" role="tablist" aria-label="Food logging method">{METHODS.map(({ id, label, icon: Icon }) => {
      const photoUnavailable = id === 'photo' && photoAvailability.state === 'unavailable' && mode !== 'photo'
      return <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'selected' : ''} disabled={photoUnavailable} title={photoUnavailable ? photoAvailability.message : undefined} onClick={() => { setMode(id); setAnalysis(null) }}><Icon />{label}</button>
    })}</div>
    <label className="field meal-type-field"><span>Meal</span><select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label>

    {mode === 'manual' && <div className="logger-panel">
      <fieldset className="portion-picker"><legend>Portion</legend>{PORTIONS.map((value) => <button type="button" className={portion === value ? 'selected' : ''} aria-pressed={portion === value} key={value} onClick={() => setPortion(value)}>{value}×</button>)}</fieldset>
      {favoriteFoods.length > 0 && <section className="favorite-foods" aria-labelledby="favorite-foods-title"><div><strong id="favorite-foods-title"><Star /> Favorites</strong><small>Tap once to add at {portion}×.</small></div><div>{favoriteFoods.map((food) => <div key={food.id}><button type="button" disabled={busy} onClick={() => void quickAddFavorite(food)}><span><strong>{food.name}</strong><small>{food.servingLabel} · {Math.round(food.calories * portion)} kcal</small></span><Plus /></button><button type="button" className="favorite-toggle selected" aria-label={`Remove ${food.name} from favorites`} onClick={() => void toggleFavorite(food)}><Star /></button></div>)}</div></section>}
      <label className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search foods stored on this device" aria-label="Search food database" /></label>
      {search && <div className="food-search-results">{results.map((food) => <div key={food.id}><button className="food-result" onClick={() => selectFood(food)}><span><strong>{food.name}</strong><small>{food.servingLabel} · {food.calories} kcal · {food.protein}g protein</small></span><Plus /></button><button className={`favorite-toggle ${favoriteIds.has(food.id) ? 'selected' : ''}`} aria-label={`${favoriteIds.has(food.id) ? 'Remove' : 'Add'} ${food.name} ${favoriteIds.has(food.id) ? 'from' : 'to'} favorites`} onClick={() => void toggleFavorite(food)}><Star /></button></div>)}</div>}
      {!search && favoriteFoods.length === 0 && <p className="local-food-note"><Search /> Search the offline food library, then star foods you use often.</p>}
      <FoodFields value={draft} onChange={setDraft} />
      <button className="button primary wide" disabled={busy || !draft.name || draft.calories <= 0} onClick={() => void saveManual()}>{busy ? 'Saving…' : 'Add food'} <Check /></button>
    </div>}

    {(mode === 'text' || mode === 'voice') && !analysis && <div className="logger-panel">
      <div className="provider-note"><Sparkles /><span><strong>{mode === 'voice' ? 'Speak naturally' : 'Describe the meal'}</strong><small>Every estimate opens for review before it can be saved.</small></span></div>
      {mode === 'voice' && <button className={`voice-button ${listening ? 'listening' : ''}`} onClick={startVoice}><Mic /> {listening ? 'Listening…' : 'Start voice capture'}</button>}
      <label className="field"><span>{mode === 'voice' ? 'Transcript' : 'Meal description'}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="6 eggs, 2 slices of toast and a banana" /></label>
      <button className="button primary wide" disabled={busy || description.trim().length < 3} onClick={() => void analyzeText(mode)}>{busy ? 'Analyzing…' : 'Analyze meal'} <Sparkles /></button>
    </div>}

    {mode === 'photo' && !analysis && (photoAvailability.state === 'unknown' || photoAvailability.state === 'checking') && <div className="logger-panel photo-panel"><div className="provider-note" role="status"><Sparkles /><span><strong>Checking meal analysis</strong><small>Confirming that the secure provider is available.</small></span></div></div>}

    {mode === 'photo' && !analysis && photoAvailability.state === 'unavailable' && <div className="logger-panel photo-panel"><div className="provider-note" role="status"><Camera /><span><strong>Photo analysis unavailable</strong><small>{photoAvailability.message}</small></span></div><button className="button primary wide" onClick={() => setMode('manual')}><Plus /> Log food manually</button></div>}

    {mode === 'photo' && !analysis && photoAvailability.state === 'available' && <div className="logger-panel photo-panel">
      <input ref={imageInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void analyzePhoto(event.target.files?.[0])} />
      {isNativeApp ? <div className="native-photo-actions"><button className="photo-drop" onClick={() => void openNativePhoto('camera')} disabled={busy}><Camera /><strong>{busy ? 'Analyzing image…' : 'Take meal photo'}</strong><span>Opens the phone camera.</span></button><button className="button secondary" onClick={() => void openNativePhoto('gallery')} disabled={busy}>Choose from photos</button></div> : <button className="photo-drop" onClick={() => imageInput.current?.click()} disabled={busy}><Camera /><strong>{busy ? 'Analyzing image…' : 'Take or choose a meal photo'}</strong><span>Images are estimated, never treated as precise nutrition facts.</span></button>}
      <p className="privacy-note">Images are estimates and always open for review before saving.</p>
      <label className="field"><span>Optional description</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Chicken bowl with white rice" /></label>
    </div>}

    {mode === 'barcode' && <div className="logger-panel barcode-panel"><Barcode /><h3>Scan or enter a UPC/EAN</h3><p>On supported browsers, take a clear photo of the barcode. Manual entry always remains available.</p><input ref={barcodeImageInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void scanBarcodeImage(event.target.files?.[0])}/><button className="button secondary wide" disabled={busy} onClick={() => barcodeImageInput.current?.click()}><Camera/> {busy ? 'Reading barcode…' : 'Use camera or photo'}</button><label className="field"><span>Barcode</span><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ''))} placeholder="016000275287" /></label><button className="button primary wide" disabled={busy || barcode.length < 8} onClick={() => void scanBarcode()}>{busy ? 'Looking up…' : 'Look up product'} <Search /></button></div>}

    {analysis && <AnalysisReview analysis={analysis} onChange={setAnalysis} onSave={() => void saveReviewedAnalysis()} busy={busy} />}
  </section>
}

function FoodFields({ value, onChange }: { value: MealDraftItem; onChange: (value: MealDraftItem) => void }) {
  const number = (key: keyof Pick<MealDraftItem, 'quantity' | 'calories' | 'protein' | 'carbs' | 'fat'>, next: string) => onChange({ ...value, [key]: Math.max(0, Number(next)) })
  return <div className="food-fields form-grid two"><label className="field full"><span>Food</span><input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Food name" /></label><label className="field"><span>Serving</span><input value={value.servingLabel} onChange={(event) => onChange({ ...value, servingLabel: event.target.value })} /></label><label className="field"><span>Quantity</span><input type="number" min="0.25" step="0.25" value={value.quantity} onChange={(event) => number('quantity', event.target.value)} /></label><label className="field"><span>Calories</span><input type="number" min="0" value={value.calories} onChange={(event) => number('calories', event.target.value)} /></label><label className="field"><span>Protein g</span><input type="number" min="0" step="0.1" value={value.protein} onChange={(event) => number('protein', event.target.value)} /></label><label className="field"><span>Carbs g</span><input type="number" min="0" step="0.1" value={value.carbs} onChange={(event) => number('carbs', event.target.value)} /></label><label className="field"><span>Fat g</span><input type="number" min="0" step="0.1" value={value.fat} onChange={(event) => number('fat', event.target.value)} /></label></div>
}

function AnalysisReview({ analysis, onChange, onSave, busy }: { analysis: NutritionAnalysis; onChange: (analysis: NutritionAnalysis) => void; onSave: () => void; busy: boolean }) {
  const updateItem = (index: number, key: keyof NutritionAnalysis['items'][number], value: string | number) => {
    const items = analysis.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    const total = items.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
    onChange({ ...analysis, items, total })
  }
  return <div className="analysis-review"><div className="analysis-banner"><Sparkles /><div><strong>Review this estimate</strong><span>{analysis.disclaimer}</span></div><em>{Math.round(analysis.confidence * 100)}% confidence</em></div><label className="field"><span>Meal name</span><input value={analysis.mealName} onChange={(event) => onChange({ ...analysis, mealName: event.target.value })} /></label><div className="analysis-items">{analysis.items.map((item, index) => <article key={`${item.name}-${index}`}><div className="analysis-item-head"><strong>Item {index + 1}</strong><button aria-label={`Remove ${item.name}`} onClick={() => onChange({ ...analysis, items: analysis.items.filter((_, itemIndex) => itemIndex !== index) })}><X /></button></div><div className="form-grid two"><label className="field full"><span>Food</span><input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} /></label><label className="field full"><span>Serving</span><input value={item.estimatedServing} onChange={(event) => updateItem(index, 'estimatedServing', event.target.value)} /></label>{(['calories', 'protein', 'carbs', 'fat'] as const).map((key) => <label className="field" key={key}><span>{key === 'calories' ? 'Calories' : `${key} g`}</span><input type="number" min="0" value={item[key]} onChange={(event) => updateItem(index, key, Number(event.target.value))} /></label>)}</div></article>)}</div><div className="analysis-total"><span><small>Calories</small><strong>{Math.round(analysis.total.calories)}</strong></span><span><small>Protein</small><strong>{Math.round(analysis.total.protein)}g</strong></span><span><small>Carbs</small><strong>{Math.round(analysis.total.carbs)}g</strong></span><span><small>Fat</small><strong>{Math.round(analysis.total.fat)}g</strong></span></div><button className="button primary wide" disabled={busy || analysis.items.length === 0} onClick={onSave}>{busy ? 'Saving…' : 'Save reviewed meal'} <Check /></button></div>
}

function mealTypeForNow(): MealType { const hour = new Date().getHours(); return hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 20 ? 'dinner' : 'snack' }
function message(error: unknown): string { return error instanceof Error ? error.message : 'That action could not be completed.' }

declare global {
  interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor; BarcodeDetector?: BarcodeDetectorConstructor }
  interface BarcodeDetectorConstructor { new(options?: { formats?: string[] }): BarcodeDetectorInstance }
  interface BarcodeDetectorInstance { detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>> }
  interface SpeechRecognitionConstructor { new(): SpeechRecognitionInstance }
  interface SpeechRecognitionInstance {
    lang: string; interimResults: boolean; onstart: (() => void) | null; onend: (() => void) | null;
    onerror: (() => void) | null; onresult: ((event: { results: ArrayLike<{ [index: number]: { transcript: string } }> }) => void) | null; start(): void
  }
}
