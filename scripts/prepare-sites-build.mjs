import { cp, copyFile, mkdir, readdir, rm } from 'node:fs/promises'

await mkdir('dist/server', { recursive: true })
await copyFile('sites/worker.js', 'dist/server/index.js')
await copyFile('sites/nutrition-api.js', 'dist/server/nutrition-api.js')

await rm('dist/client', { recursive: true, force: true })
await mkdir('dist/client', { recursive: true })

const entries = await readdir('dist', { withFileTypes: true })
for (const entry of entries) {
  if (entry.name === '.openai' || entry.name === 'client' || entry.name === 'server') continue
  await cp(`dist/${entry.name}`, `dist/client/${entry.name}`, { recursive: true })
}
