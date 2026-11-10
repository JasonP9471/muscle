import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE_JSON = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const SOURCE_IMAGES = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const ROOT = path.resolve(import.meta.dirname, '..')
const EXERCISE_SOURCE = path.join(ROOT, 'src/data/exercises.ts')
const OUTPUT_DIR = path.join(ROOT, 'public/exercise-guides/library')
const createGrid = (width, height, [firstColumn, secondColumn], [firstRow, secondRow]) => ({
  width,
  height,
  columns: [
    { left: 2, width: firstColumn - 4 },
    { left: firstColumn + 2, width: secondColumn - firstColumn - 4 },
    { left: secondColumn + 2, width: width - secondColumn - 4 },
  ],
  rows: [
    { top: 2, height: firstRow - 4 },
    { top: firstRow + 2, height: secondRow - firstRow - 4 },
    { top: secondRow + 2, height: height - secondRow - 4 },
  ],
})

const UPPER_PUSH_GRID = createGrid(1312, 1199, [436, 902], [392, 754])
const UPPER_PULL_GRID = createGrid(1312, 1199, [468, 903], [354, 773])
const ROWS_SQUATS_GRID = createGrid(1536, 1024, [511, 1021], [341, 661])
const LEG_VARIANTS_GRID = createGrid(1536, 1024, [511, 1022], [327, 650])
const POSTERIOR_CHAIN_GRID = createGrid(1536, 1024, [511, 1023], [325, 641])
const ARMS_CORE_GRID = createGrid(1536, 1024, [511, 1024], [333, 667])
const CORE_CARRIES_CARDIO_GRID = createGrid(1536, 1024, [529, 1020], [326, 658])

const CUSTOM_SEQUENCE_SHEETS = [
  {
    file: 'custom-exercise-sequences.png',
    width: 1536,
    height: 1024,
    columns: [{ left: 2, width: 508 }, { left: 514, width: 572 }, { left: 1090, width: 444 }],
    rows: [{ top: 2, height: 304 }, { top: 310, height: 326 }, { top: 640, height: 382 }],
    cells: [
      'bird-dog',
      'hollow-body-hold',
      'resistance-band-chest-press',
      'resistance-band-fly',
      'kneeling-cable-pulldown',
      'reverse-nordic-curl',
      'cable-hip-abduction',
      'kettlebell-front-rack-carry',
      'half-kneeling-landmine-press',
    ],
  },
  {
    file: 'accuracy-audit-upper-push.png',
    ...UPPER_PUSH_GRID,
    cells: [
      'spoto-press',
      'barbell-overhead-press',
      'dumbbell-shoulder-press',
      'neutral-grip-dumbbell-shoulder-press',
      'z-press',
      'arnold-press',
      'kettlebell-strict-press',
      'half-kneeling-kettlebell-press',
      'pike-push-up',
    ],
  },
  {
    file: 'accuracy-audit-upper-pull.png',
    ...UPPER_PULL_GRID,
    cells: [
      'cable-lateral-raise',
      'leaning-cable-lateral-raise',
      'resistance-band-face-pull',
      'pull-up',
      'neutral-grip-pull-up',
      'wide-grip-pull-up',
      'assisted-pull-up',
      'assisted-chin-up',
      'resistance-band-pulldown',
    ],
  },
  {
    file: 'accuracy-audit-rows-squats.png',
    ...ROWS_SQUATS_GRID,
    cells: [
      'pendlay-row',
      'dumbbell-gorilla-row',
      'resistance-band-row',
      'prone-y-raise',
      'goblet-squat',
      'dumbbell-front-squat',
      'smith-machine-front-squat',
      'reverse-hack-squat',
      'single-leg-press',
    ],
  },
  {
    file: 'accuracy-audit-leg-variants.png',
    ...LEG_VARIANTS_GRID,
    cells: [
      'narrow-stance-leg-press',
      'wide-stance-leg-press',
      'spanish-squat',
      'bulgarian-split-squat',
      'bodyweight-bulgarian-split-squat',
      'front-foot-elevated-split-squat',
      'lateral-lunge',
      'curtsy-lunge',
      'lateral-step-up',
    ],
  },
  {
    file: 'accuracy-audit-posterior-chain.png',
    ...POSTERIOR_CHAIN_GRID,
    cells: [
      'resistance-band-leg-extension',
      'single-leg-romanian-deadlift',
      'kettlebell-romanian-deadlift',
      'kettlebell-swing',
      'dumbbell-hip-thrust',
      'single-leg-hip-thrust',
      'nordic-hamstring-curl',
      'resistance-band-kickback',
      'single-leg-dumbbell-calf-raise',
    ],
  },
  {
    file: 'accuracy-audit-arms-core.png',
    ...ARMS_CORE_GRID,
    cells: [
      'bodyweight-calf-raise',
      'tibialis-raise',
      'bayesian-cable-curl',
      'resistance-band-curl',
      'dumbbell-skull-crusher',
      'single-arm-cable-pushdown',
      'resistance-band-pushdown',
      'front-plank',
      'hanging-knee-raise',
    ],
  },
  {
    file: 'accuracy-audit-core-carries-cardio.png',
    ...CORE_CARRIES_CARDIO_GRID,
    cells: [
      'ab-wheel-rollout',
      'resistance-band-pallof-press',
      'suitcase-carry',
      'overhead-carry',
      'treadmill-incline-walk',
      'bike-sprint-intervals',
      'deficit-push-up',
    ],
  },
]

const CUSTOM_SEQUENCE_IDS = new Set(CUSTOM_SEQUENCE_SHEETS.flatMap(({ cells }) => cells))

// TrainOS names intentionally stay user-facing and concise. These aliases select an
// equivalent source sequence when the public-domain dataset uses a different name.
const SOURCE_ALIASES = {
  'Barbell Bench Press': 'Barbell Bench Press - Medium Grip',
  'Paused Barbell Bench Press': 'Barbell Bench Press - Medium Grip',
  'Spoto Press': 'Barbell Bench Press - Medium Grip',
  'Incline Barbell Bench Press': 'Barbell Incline Bench Press - Medium Grip',
  'Close-Grip Bench Press': 'Close-Grip Barbell Bench Press',
  'Barbell Floor Press': 'Floor Press',
  'Decline Dumbbell Press': 'Decline Dumbbell Bench Press',
  'Neutral-Grip Dumbbell Press': 'Dumbbell Bench Press with Neutral Grip',
  'Single-Arm Dumbbell Bench Press': 'One Arm Dumbbell Bench Press',
  'Kettlebell Floor Press': 'One-Arm Kettlebell Floor Press',
  'Chest Press Machine': 'Leverage Chest Press',
  'Incline Chest Press Machine': 'Leverage Incline Chest Press',
  'Smith Machine Incline Press': 'Smith Machine Incline Bench Press',
  'Single-Arm Cable Chest Press': 'Cable Chest Press',
  'Cable Fly': 'Flat Bench Cable Flyes',
  'High-to-Low Cable Fly': 'Cable Crossover',
  'Low-to-High Cable Fly': 'Low Cable Crossover',
  'Single-Arm Cable Fly': 'Single-Arm Cable Crossover',
  'Pec Deck Fly': 'Butterfly',
  'Dumbbell Fly': 'Dumbbell Flyes',
  'Push-Up': 'Push-Up Wide',
  'Diamond Push-Up': 'Push-Ups - Close Triceps Position',
  'Deficit Push-Up': 'Suspended Push-Up',
  'Resistance Band Chest Press': 'Shoulder Press - With Bands',
  'Resistance Band Fly': 'Cable Crossover',
  'Assisted Dip': 'Dip Machine',
  'Barbell Overhead Press': 'Barbell Shoulder Press',
  'Seated Barbell Overhead Press': 'Barbell Shoulder Press',
  'Z Press': 'Barbell Shoulder Press',
  'Seated Dumbbell Shoulder Press': 'Dumbbell Shoulder Press',
  'Neutral-Grip Dumbbell Shoulder Press': 'Dumbbell Shoulder Press',
  'Single-Arm Dumbbell Overhead Press': 'Dumbbell One-Arm Shoulder Press',
  'Arnold Press': 'Kettlebell Arnold Press',
  'Kettlebell Strict Press': 'Kettlebell Seated Press',
  'Half-Kneeling Kettlebell Press': 'Dumbbell One-Arm Shoulder Press',
  'Landmine Press': 'Landmine Linear Jammer',
  'Half-Kneeling Landmine Press': 'Single-Arm Linear Jammer',
  'Shoulder Press Machine': 'Machine Shoulder (Military) Press',
  'Smith Machine Shoulder Press': 'Smith Machine Overhead Shoulder Press',
  'Single-Arm Cable Shoulder Press': 'Alternating Cable Shoulder Press',
  'Pike Push-Up': 'Handstand Push-Ups',
  'Dumbbell Lateral Raise': 'Side Lateral Raise',
  'Cable Lateral Raise': 'Cable Seated Lateral Raise',
  'Leaning Cable Lateral Raise': 'One-Arm Incline Lateral Raise',
  'Seated Dumbbell Lateral Raise': 'Seated Side Lateral Raise',
  'Resistance Band Lateral Raise': 'Lateral Raise - With Bands',
  'Dumbbell Front Raise': 'Front Dumbbell Raise',
  'Cable Front Raise': 'Front Cable Raise',
  'Reverse Pec Deck': 'Reverse Machine Flyes',
  'Bent-Over Dumbbell Rear Delt Fly': 'Bent Over Dumbbell Rear Delt Raise With Head On Bench',
  'Resistance Band Face Pull': 'Face Pull',
  'Pull-Up': 'Wide-Grip Rear Pull-Up',
  'Neutral-Grip Pull-Up': 'Chin-Up',
  'Wide-Grip Pull-Up': 'Wide-Grip Rear Pull-Up',
  'Assisted Pull-Up': 'Band Assisted Pull-Up',
  'Assisted Chin-Up': 'Chin-Up',
  'Lat Pulldown': 'Full Range-Of-Motion Lat Pulldown',
  'Close-Grip Lat Pulldown': 'Close-Grip Front Lat Pulldown',
  'Neutral-Grip Lat Pulldown': 'V-Bar Pulldown',
  'Single-Arm Lat Pulldown': 'One Arm Lat Pulldown',
  'Kneeling Cable Pulldown': 'Straight-Arm Pulldown',
  'Straight-Arm Cable Pulldown': 'Rope Straight-Arm Pulldown',
  'Resistance Band Pulldown': 'Straight-Arm Pulldown',
  'Barbell Bent-Over Row': 'Bent Over Barbell Row',
  'Pendlay Row': 'Bent Over Barbell Row',
  'Underhand Barbell Row': 'Reverse Grip Bent-Over Rows',
  'Seal Row': 'Lying Cambered Barbell Row',
  'T-Bar Row': 'T-Bar Row with Handle',
  'Meadows Row': 'One-Arm Long Bar Row',
  'Chest-Supported Dumbbell Row': 'Dumbbell Incline Row',
  'Dumbbell Gorilla Row': 'Bent Over Two-Dumbbell Row',
  'Kettlebell Row': 'One-Arm Kettlebell Row',
  'Seated Cable Row': 'Seated Cable Rows',
  'Close-Grip Cable Row': 'Seated Cable Rows',
  'Wide-Grip Cable Row': 'Elevated Cable Rows',
  'Single-Arm Cable Row': 'Seated One-arm Cable Pulley Rows',
  'Chest-Supported Machine Row': 'Leverage High Row',
  'Resistance Band Row': 'Suspended Row',
  'Cable Shrug': 'Cable Shrugs',
  'Prone Y Raise': 'Dumbbell Incline Shoulder Raise',
  'Barbell Back Squat': 'Barbell Full Squat',
  'High-Bar Back Squat': 'Olympic Squat',
  'Low-Bar Back Squat': 'Barbell Squat',
  'Front Squat': 'Front Barbell Squat',
  'Paused Back Squat': 'Barbell Full Squat',
  'Zercher Squat': 'Zercher Squats',
  'Kettlebell Goblet Squat': 'Goblet Squat',
  'Double Kettlebell Front Squat': 'Front Squats With Two Kettlebells',
  'Dumbbell Front Squat': 'Dumbbell Squat',
  'Smith Machine Front Squat': 'Smith Machine Squat',
  'Reverse Hack Squat': 'Hack Squat',
  'Single-Leg Press': 'Smith Machine Leg Press',
  'Wide-Stance Leg Press': 'Leg Press',
  'Tempo Bodyweight Squat': 'Bodyweight Squat',
  'Spanish Squat': 'Weighted Sissy Squat',
  'Bulgarian Split Squat': 'Split Squat with Dumbbells',
  'Bodyweight Bulgarian Split Squat': 'Split Squats',
  'Front-Foot-Elevated Split Squat': 'Elevated Back Lunge',
  'Reverse Lunge': 'Dumbbell Rear Lunge',
  'Walking Lunge': 'Bodyweight Walking Lunge',
  'Forward Lunge': 'Dumbbell Lunges',
  'Lateral Lunge': 'Barbell Side Split Squat',
  'Curtsy Lunge': 'Crossover Reverse Lunge',
  'Step-Up': 'Dumbbell Step Ups',
  'Lateral Step-Up': 'Dumbbell Step Ups',
  'Reverse Nordic Curl': 'Weighted Sissy Squat',
  'Leg Extension': 'Leg Extensions',
  'Single-Leg Extension': 'Single-Leg Leg Extension',
  'Resistance Band Leg Extension': 'Leg Extensions',
  'Sissy Squat': 'Weighted Sissy Squat',
  'Conventional Deadlift': 'Barbell Deadlift',
  'Dumbbell Romanian Deadlift': 'Stiff-Legged Dumbbell Deadlift',
  'Single-Leg Romanian Deadlift': 'Kettlebell One-Legged Deadlift',
  'Kettlebell Romanian Deadlift': 'Romanian Deadlift',
  'Stiff-Leg Deadlift': 'Stiff-Legged Barbell Deadlift',
  'Cable Pull-Through': 'Pull Through',
  'Kettlebell Swing': 'One-Arm Kettlebell Swings',
  'Dumbbell Hip Thrust': 'Barbell Hip Thrust',
  'Single-Leg Hip Thrust': 'Single Leg Glute Bridge',
  'Glute Bridge': 'Butt Lift (Bridge)',
  'Smith Machine Hip Thrust': 'Smith Machine Hip Raise',
  'Lying Leg Curl': 'Lying Leg Curls',
  'Single-Leg Curl': 'Standing Leg Curl',
  'Resistance Band Leg Curl': 'Seated Band Hamstring Curl',
  'Nordic Hamstring Curl': 'Natural Glute Ham Raise',
  'Cable Kickback': 'One-Legged Cable Kickback',
  'Resistance Band Kickback': 'Glute Kickback',
  'Hip Abduction Machine': 'Thigh Abductor',
  'Cable Hip Abduction': 'Side Leg Raises',
  'Banded Lateral Walk': 'Monster Walk',
  'Hip Adduction Machine': 'Thigh Adductor',
  'Standing Calf Raise': 'Standing Calf Raises',
  'Leg Press Calf Raise': 'Calf Press On The Leg Press Machine',
  'Single-Leg Dumbbell Calf Raise': 'Dumbbell Seated One-Leg Calf Raise',
  'Bodyweight Calf Raise': 'Standing Calf Raises',
  'Tibialis Raise': 'Smith Machine Reverse Calf Raises',
  'Dumbbell Curl': 'Dumbbell Bicep Curl',
  'Alternating Dumbbell Curl': 'Dumbbell Alternate Bicep Curl',
  'Hammer Curl': 'Hammer Curls',
  'Dumbbell Preacher Curl': 'One Arm Dumbbell Preacher Curl',
  'Cable Curl': 'Standing Biceps Cable Curl',
  'Bayesian Cable Curl': 'Standing One-Arm Cable Curl',
  'Rope Hammer Curl': 'Cable Hammer Curls - Rope Attachment',
  'Resistance Band Curl': 'Close-Grip EZ-Bar Curl with Band',
  'Concentration Curl': 'Concentration Curls',
  'Reverse Curl': 'Reverse Barbell Curl',
  'EZ-Bar Skull Crusher': 'EZ-Bar Skullcrusher',
  'Dumbbell Skull Crusher': 'Decline Dumbbell Triceps Extension',
  'Rope Triceps Pushdown': 'Triceps Pushdown - Rope Attachment',
  'Straight-Bar Triceps Pushdown': 'Triceps Pushdown',
  'Single-Arm Cable Pushdown': 'Reverse Grip Triceps Pushdown',
  'Cable Overhead Triceps Extension': 'Cable Rope Overhead Triceps Extension',
  'Dumbbell Overhead Triceps Extension': 'Standing Dumbbell Triceps Extension',
  'Single-Arm Dumbbell Triceps Extension': 'Standing One-Arm Dumbbell Triceps Extension',
  'Dumbbell Tate Press': 'Tate Press',
  'Resistance Band Pushdown': 'Triceps Pushdown',
  'Bench Dip': 'Bench Dips',
  'Dumbbell Wrist Curl': 'Palms-Up Dumbbell Wrist Curl Over A Bench',
  'Dumbbell Reverse Wrist Curl': 'Palms-Down Dumbbell Wrist Curl Over A Bench',
  'Barbell Wrist Curl': 'Palms-Up Barbell Wrist Curl Over A Bench',
  'Plate Pinch Hold': 'Plate Pinch',
  'Front Plank': 'Plank',
  'Side Plank': 'Side Bridge',
  'Bird Dog': 'Superman',
  'Hollow Body Hold': 'Flat Bench Lying Leg Raise',
  'Hanging Knee Raise': 'Knee/Hip Raise On Parallel Bars',
  'Captain Chair Knee Raise': 'Knee/Hip Raise On Parallel Bars',
  'Ab Wheel Rollout': 'Barbell Ab Rollout - On Knees',
  'Bicycle Crunch': 'Air Bike',
  'Resistance Band Pallof Press': 'Pallof Press',
  'Cable Wood Chop': 'Standing Cable Wood Chop',
  'Back Extension': 'Hyperextensions (Back Extensions)',
  'Suitcase Carry': "Farmer's Walk",
  'Farmer Carry': "Farmer's Walk",
  'Kettlebell Front-Rack Carry': 'Rickshaw Carry',
  'Overhead Carry': 'Sled Overhead Backward Walk',
  'Treadmill Walk': 'Walking, Treadmill',
  'Treadmill Incline Walk': 'Walking, Treadmill',
  'Treadmill Run': 'Running, Treadmill',
  'Stationary Bike': 'Bicycling, Stationary',
  'Rowing Machine': 'Rowing, Stationary',
  'Stair Climber': 'Stairmaster',
  'Bike Sprint Intervals': 'Bicycling, Stationary',
}

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Unable to download ${url}: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function renderSequence(exerciseName, source) {
  const imageBuffers = await Promise.all(source.images.slice(0, 2).map((image) => download(`${SOURCE_IMAGES}/${image}`)))
  if (imageBuffers.length === 1) imageBuffers.push(imageBuffers[0])
  const frames = await Promise.all(imageBuffers.map((buffer) => sharp(buffer)
    .resize(314, 226, { fit: 'contain', background: '#f4f2ed' })
    .flatten({ background: '#f4f2ed' })
    .jpeg({ quality: 82 })
    .toBuffer()))
  const canvas = sharp({ create: { width: 648, height: 238, channels: 3, background: '#f4f2ed' } })
  await canvas.composite([
    { input: frames[0], left: 6, top: 6 },
    { input: frames[1], left: 328, top: 6 },
    { input: Buffer.from('<svg width="2" height="214"><rect width="2" height="214" rx="1" fill="#d6d2c8"/></svg>'), left: 323, top: 12 },
  ]).webp({ quality: 76, effort: 5 }).toFile(path.join(OUTPUT_DIR, `${slugify(exerciseName)}.webp`))
}

async function renderCustomSequences() {
  for (const sheet of CUSTOM_SEQUENCE_SHEETS) {
    const sheetPath = path.join(ROOT, 'scripts/assets', sheet.file)
    const metadata = await sharp(sheetPath).metadata()
    if (metadata.width !== sheet.width || metadata.height !== sheet.height) {
      throw new Error(`Unexpected dimensions for ${sheet.file}: ${metadata.width}x${metadata.height}`)
    }
    await Promise.all(sheet.cells.map(async (exerciseId, cell) => {
      const column = sheet.columns[cell % 3]
      const row = sheet.rows[Math.floor(cell / 3)]
      await sharp(sheetPath)
        .extract({ left: column.left, top: row.top, width: column.width, height: row.height })
        .resize(648, 238, { fit: 'contain', background: '#f4f2ed' })
        .webp({ quality: 78, effort: 5 })
        .toFile(path.join(OUTPUT_DIR, `${exerciseId}.webp`))
    }))
  }
}

async function main() {
  const [exerciseSource, sourceDatabase] = await Promise.all([
    fs.readFile(EXERCISE_SOURCE, 'utf8'),
    fetch(SOURCE_JSON).then((response) => {
      if (!response.ok) throw new Error(`Unable to download source database: ${response.status}`)
      return response.json()
    }),
  ])
  const exerciseNames = [...exerciseSource.matchAll(/^  \['([^']+)',/gm)].map((match) => match[1])
  const byName = new Map(sourceDatabase.map((exercise) => [normalize(exercise.name), exercise]))
  const selections = exerciseNames.map((name) => {
    const sourceName = SOURCE_ALIASES[name] ?? name
    const source = byName.get(normalize(sourceName))
    if (!source) throw new Error(`No image source for ${name}: ${sourceName}`)
    return { name, source }
  })
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const workerCount = 8
  let cursor = 0
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < selections.length) {
      const selection = selections[cursor++]
      if (CUSTOM_SEQUENCE_IDS.has(slugify(selection.name))) continue
      await renderSequence(selection.name, selection.source)
      process.stdout.write('.')
    }
  })
  await Promise.all(workers)
  await renderCustomSequences()
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(exerciseNames.map(slugify), null, 2)}\n`)
  const uniqueSources = new Set(selections.map(({ source }) => source.id)).size
  console.log(`\nCreated ${selections.length} local exercise sequences from ${uniqueSources} source movements and ${CUSTOM_SEQUENCE_IDS.size} audited custom sequences.`)
}

await main()
