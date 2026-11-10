import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const EXERCISE_SOURCE = path.join(ROOT, 'src/data/exercises.ts')
const IMAGE_DIR = path.join(ROOT, 'public/exercise-guides/library')
const OUTPUT_DIR = process.argv[2] ?? path.join(ROOT, 'artifacts/illustration-audit')
const COLUMNS = 4
const ROWS = 5
const TILE_WIDTH = 500
const TILE_HEIGHT = 248
const IMAGE_WIDTH = 476
const IMAGE_HEIGHT = 175

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

async function createTile(name, index) {
  const id = slugify(name)
  const image = await sharp(path.join(IMAGE_DIR, `${id}.webp`))
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'contain', background: '#f4f2ed' })
    .png()
    .toBuffer()
  const label = Buffer.from(`
    <svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <rect x="10" y="10" width="${IMAGE_WIDTH + 4}" height="${IMAGE_HEIGHT + 4}" rx="8" fill="#f4f2ed" stroke="#d6d2c8"/>
      <text x="12" y="213" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111111">${escapeXml(`${index + 1}. ${name}`)}</text>
      <text x="12" y="237" font-family="Arial, sans-serif" font-size="14" fill="#666666">${escapeXml(id)}</text>
    </svg>
  `)
  return sharp(label).composite([{ input: image, left: 12, top: 12 }]).png().toBuffer()
}

async function main() {
  const source = await fs.readFile(EXERCISE_SOURCE, 'utf8')
  const names = [...source.matchAll(/^  \['([^']+)',/gm)].map((match) => match[1])
  const tilesPerSheet = COLUMNS * ROWS
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  for (let start = 0; start < names.length; start += tilesPerSheet) {
    const page = names.slice(start, start + tilesPerSheet)
    const tiles = await Promise.all(page.map((name, offset) => createTile(name, start + offset)))
    const composites = tiles.map((input, index) => ({
      input,
      left: (index % COLUMNS) * TILE_WIDTH,
      top: Math.floor(index / COLUMNS) * TILE_HEIGHT,
    }))
    const sheetNumber = Math.floor(start / tilesPerSheet) + 1
    await sharp({
      create: {
        width: COLUMNS * TILE_WIDTH,
        height: ROWS * TILE_HEIGHT,
        channels: 3,
        background: '#ffffff',
      },
    }).composite(composites).png().toFile(path.join(OUTPUT_DIR, `sheet-${String(sheetNumber).padStart(2, '0')}.png`))
  }

  process.stdout.write(`Created ${Math.ceil(names.length / tilesPerSheet)} audit sheets for ${names.length} illustrations in ${OUTPUT_DIR}\n`)
}

await main()
