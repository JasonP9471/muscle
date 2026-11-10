import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Check, Plus, Scale, Trash2 } from 'lucide-react'
import { db } from '../../db/database'
import { useUIStore } from '../../stores/uiStore'
import { privateStorage } from '../../services/storage/provider'
import { chooseNativePhoto, isNativeApp, takeNativePhoto } from '../../services/mobile'
import type { Profile } from '../../types'

export function BodyCheckin({ profile }: { profile: Profile }) {
  const photos = useLiveQuery(() => db.progressPhotos.orderBy('loggedAt').reverse().toArray(), []) ?? []
  const settings = useLiveQuery(() => db.appSettings.get('primary'), [])
  const [weight, setWeight] = useState(String(profile.bodyWeight))
  const [showCheckin, setShowCheckin] = useState(false)
  const [checkin, setCheckin] = useState({ energy: 3, hunger: 3, performance: 3, recovery: 3, notes: '' })
  const photoInput = useRef<HTMLInputElement>(null)
  const addToast = useUIStore((state) => state.addToast)
  const saveWeight = async () => {
    const parsed = Number(weight)
    if (!Number.isFinite(parsed) || parsed <= 0) { addToast('Enter a valid body weight.', 'error'); return }
    await db.transaction('rw', [db.bodyMetrics, db.profiles], async () => {
      await db.bodyMetrics.put({ id: crypto.randomUUID(), loggedAt: new Date().toISOString(), weight: parsed, notes: 'Progress check-in' })
      await db.profiles.update('primary', { bodyWeight: parsed, updatedAt: new Date().toISOString() })
    })
    addToast('Weight trend updated.', 'success')
  }
  const saveCheckin = async () => {
    const parsed = Number(weight)
    if (!Number.isFinite(parsed) || parsed <= 0) { addToast('Enter a valid weight for this check-in.', 'error'); return }
    await db.weeklyCheckins.put({ id: crypto.randomUUID(), loggedAt: new Date().toISOString(), weight: parsed, ...checkin })
    await saveWeight(); setShowCheckin(false); addToast('Weekly check-in saved for adaptive recommendations.', 'success')
  }
  const addPhoto = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { addToast('Choose an image file.', 'error'); return }
    try {
      const localUrl = await compressImage(file)
      const id = crypto.randomUUID()
      await db.progressPhotos.put({ id, loggedAt: new Date().toISOString(), localUrl, syncState: settings?.cloudSyncEnabled && privateStorage.mode === 'supabase' ? 'pending' : 'local', caption: 'Progress check-in' })
      if (settings?.cloudSyncEnabled && privateStorage.mode === 'supabase') {
        try {
          const storagePath = await privateStorage.upload('progress-photos', await (await fetch(localUrl)).blob())
          await db.progressPhotos.update(id, { storagePath, syncState: 'synced' })
          addToast('Progress photo saved locally and synced privately.', 'success')
        } catch (error) {
          await db.progressPhotos.update(id, { syncState: 'failed' })
          addToast(error instanceof Error ? error.message : 'Cloud upload failed; the local copy is safe.', 'error')
        }
      } else addToast('Progress photo saved privately on this device.', 'success')
    } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to save that photo.', 'error') }
    if (photoInput.current) photoInput.current.value = ''
  }
  const openNativePhoto = async (source: 'camera' | 'gallery') => {
    try {
      const file = source === 'camera' ? await takeNativePhoto('progress') : await chooseNativePhoto('progress')
      if (file) await addPhoto(file)
    } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to open photos.', 'error') }
  }
  return <section className="checkin-section"><div className="section-heading"><div><p className="eyebrow">Body composition</p><h2>Check-in</h2></div><button className="button secondary" onClick={() => setShowCheckin(!showCheckin)}><Plus/> Weekly check-in</button></div><div className="quick-weigh-in"><Scale/><label className="field"><span>Current weight ({profile.units})</span><input type="number" step="0.1" min="1" value={weight} onChange={(event) => setWeight(event.target.value)}/></label><button className="button primary" onClick={() => void saveWeight()}><Check/> Log weight</button><input ref={photoInput} className="visually-hidden" type="file" accept="image/*" onChange={(event) => void addPhoto(event.target.files?.[0])}/>{isNativeApp ? <div className="checkin-photo-actions"><button className="button secondary" onClick={() => void openNativePhoto('camera')}><Camera/> Take photo</button><button className="button secondary" onClick={() => void openNativePhoto('gallery')}>Choose photo</button></div> : <button className="button secondary" onClick={() => photoInput.current?.click()}><Camera/> Add photo</button>}</div>{showCheckin && <div className="weekly-checkin"><div className="checkin-ratings">{(['energy','hunger','performance','recovery'] as const).map((key) => <label key={key}><span>{key}</span><select value={checkin[key]} onChange={(event) => setCheckin({ ...checkin, [key]: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label>)}</div><label className="field"><span>Context <small>optional</small></span><textarea value={checkin.notes} onChange={(event) => setCheckin({ ...checkin, notes: event.target.value })} placeholder="Sleep, soreness, hunger, performance…"/></label><button className="button primary" onClick={() => void saveCheckin()}><Check/> Save weekly check-in</button></div>}{photos.length > 0 && <div className="progress-photo-grid">{photos.map((photo) => <figure key={photo.id}>{photo.localUrl && <img src={photo.localUrl} alt={photo.caption || 'Private progress check-in'}/>}<figcaption><span><strong>{new Date(photo.loggedAt).toLocaleDateString()}</strong><small>{photo.syncState === 'local' ? 'Private on this device' : photo.syncState}</small></span><button aria-label={`Delete progress photo from ${new Date(photo.loggedAt).toLocaleDateString()}`} onClick={() => void db.progressPhotos.delete(photo.id)}><Trash2/></button></figcaption></figure>)}</div>}</section>
}

async function compressImage(file: File): Promise<string> {
  const source = await fileToDataUrl(file)
  const image = new Image()
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('That image could not be read.')); image.src = source })
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
  const context = canvas.getContext('2d'); if (!context) throw new Error('Image compression is unavailable.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.78)
}
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read image.')); reader.onerror = () => reject(new Error('Unable to read image.')); reader.readAsDataURL(file) }) }
