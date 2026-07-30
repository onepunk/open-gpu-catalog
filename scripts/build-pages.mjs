import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootPath = dirname(dirname(fileURLToPath(import.meta.url)))
const sitePath = join(rootPath, 'site')
const catalogPath = join(rootPath, 'dist', 'catalog.json')
const outputPath = join(rootPath, '.pages')

await rm(outputPath, { recursive: true, force: true })
await mkdir(outputPath, { recursive: true })
await cp(sitePath, outputPath, { recursive: true })
await copyFile(catalogPath, join(outputPath, 'catalog.json'))
await writeFile(join(outputPath, '.nojekyll'), '')

console.log(`GitHub Pages bundle written to ${outputPath}`)
