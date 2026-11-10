import { DEFAULT_BAR_WEIGHT, PLATE_OPTIONS, QUICK_WEIGHT_STEP, WARMUP_STAGES } from '../../config/workoutAssist'
import type { SetPrescription, Units } from '../../types'

export interface PlateLoad {
  targetWeight: number
  barWeight: number
  loadedWeight: number
  remainder: number
  perSide: Array<{ plate: number; count: number }>
}

const round = (value: number): number => Math.round(value * 100) / 100

export function calculatePlateLoad(targetWeight: number, units: Units, barWeight = DEFAULT_BAR_WEIGHT[units]): PlateLoad {
  const safeTarget = Math.max(0, targetWeight)
  const safeBar = Math.max(0, barWeight)
  let perSideRemaining = Math.max(0, (safeTarget - safeBar) / 2)
  const perSide: PlateLoad['perSide'] = []
  for (const plate of PLATE_OPTIONS[units]) {
    const count = Math.floor((perSideRemaining + 0.0001) / plate)
    if (count > 0) {
      perSide.push({ plate, count })
      perSideRemaining = round(perSideRemaining - count * plate)
    }
  }
  const loadedWeight = round(safeBar + 2 * perSide.reduce((sum, item) => sum + item.plate * item.count, 0))
  return { targetWeight: safeTarget, barWeight: safeBar, loadedWeight, remainder: round(safeTarget - loadedWeight), perSide }
}

export function generateWarmupSets(workingWeight: number, units: Units): SetPrescription[] {
  const increment = QUICK_WEIGHT_STEP[units]
  const seen = new Set<number>()
  return WARMUP_STAGES.flatMap((stage) => {
    const weight = Math.max(increment, Math.round((workingWeight * stage.percentage) / increment) * increment)
    if (weight <= 0 || weight >= workingWeight || seen.has(weight)) return []
    seen.add(weight)
    return [{
      id: crypto.randomUUID(),
      setNumber: seen.size,
      targetRepMin: stage.reps,
      targetRepMax: stage.reps,
      restSeconds: stage.restSeconds,
      completed: false,
      weight,
      reps: stage.reps,
      rir: 5,
      isWarmup: true,
    }]
  })
}
