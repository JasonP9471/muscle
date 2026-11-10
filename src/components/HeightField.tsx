import { cmToFeetInches, feetInchesToCm } from '../utils/measurements'

export function HeightField({ heightCm, units, onChange }: { heightCm: number; units: 'lb' | 'kg'; onChange: (heightCm: number) => void }) {
  if (units === 'kg') {
    return <label className="field"><span>Height <small>cm</small></span><input aria-label="Height in centimetres" type="number" min="100" max="250" value={heightCm} onChange={(event) => onChange(Number(event.target.value))}/></label>
  }
  const height = cmToFeetInches(heightCm)
  return <fieldset className="height-field"><legend>Height</legend><label><span className="visually-hidden">Feet</span><input aria-label="Height in feet" type="number" min="3" max="8" value={height.feet} onChange={(event) => onChange(feetInchesToCm(Number(event.target.value), height.inches))}/><small>ft</small></label><label><span className="visually-hidden">Inches</span><input aria-label="Height in inches" type="number" min="0" max="11" value={height.inches} onChange={(event) => onChange(feetInchesToCm(height.feet, Number(event.target.value)))}/><small>in</small></label></fieldset>
}
