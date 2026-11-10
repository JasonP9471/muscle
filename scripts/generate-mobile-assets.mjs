import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const accent = '#c8ff36'
const ink = '#090b0c'

function markSvg(width, height, background, markColor, markScale = 0.52) {
  const centerX = width / 2
  const centerY = height / 2
  const markWidth = Math.min(width, height) * markScale
  const shaftHeight = markWidth * 0.11
  const innerWidth = markWidth * 0.13
  const innerHeight = markWidth * 0.36
  const outerWidth = markWidth * 0.1
  const outerHeight = markWidth * 0.24
  const left = centerX - markWidth / 2
  const right = centerX + markWidth / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : ''}
    <rect x="${left}" y="${centerY - shaftHeight / 2}" width="${markWidth}" height="${shaftHeight}" fill="${markColor}"/>
    <rect x="${left + outerWidth}" y="${centerY - innerHeight / 2}" width="${innerWidth}" height="${innerHeight}" fill="${markColor}"/>
    <rect x="${right - outerWidth - innerWidth}" y="${centerY - innerHeight / 2}" width="${innerWidth}" height="${innerHeight}" fill="${markColor}"/>
    <rect x="${left}" y="${centerY - outerHeight / 2}" width="${outerWidth}" height="${outerHeight}" fill="${markColor}"/>
    <rect x="${right - outerWidth}" y="${centerY - outerHeight / 2}" width="${outerWidth}" height="${outerHeight}" fill="${markColor}"/>
  </svg>`
}

async function render(svg, output, opaque = false) {
  const temporary = `${output}.next.png`
  const image = sharp(Buffer.from(svg))
  await (opaque ? image.removeAlpha() : image).png().toFile(temporary)
  await rename(temporary, output)
}

await render(
  markSvg(1024, 1024, accent, ink, 0.6),
  path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'),
  true,
)

for (const filename of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await render(
    markSvg(2732, 2732, ink, accent, 0.22),
    path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset', filename),
    true,
  )
}

const androidRes = path.join(root, 'android/app/src/main/res')
const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const foregroundSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }
for (const [density, size] of Object.entries(launcherSizes)) {
  const directory = path.join(androidRes, `mipmap-${density}`)
  await render(markSvg(size, size, accent, ink, 0.6), path.join(directory, 'ic_launcher.png'), true)
  await render(markSvg(size, size, accent, ink, 0.6), path.join(directory, 'ic_launcher_round.png'), true)
  const foregroundSize = foregroundSizes[density]
  await render(markSvg(foregroundSize, foregroundSize, null, ink, 0.5), path.join(directory, 'ic_launcher_foreground.png'))
}

const resourceDirectories = await readdir(androidRes, { withFileTypes: true })
for (const entry of resourceDirectories) {
  if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue
  const output = path.join(androidRes, entry.name, 'splash.png')
  try {
    const { width, height } = await sharp(output).metadata()
    if (width && height) await render(markSvg(width, height, ink, accent, 0.22), output, true)
  } catch {
    // Some drawable folders intentionally contain only XML resources.
  }
}
