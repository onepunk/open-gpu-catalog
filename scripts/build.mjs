import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalog } from '../src/catalog.mjs'
import { buildLlmsizerArtifact } from '../src/llmsizer.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'))
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

const [
  rightnow,
  additions,
  overrides,
  aliases,
  sources,
  interconnectRules,
  integratedGpuPatterns,
] = await Promise.all([
  readJson('data/imports/rightnow/all-gpus.json'),
  readJson('data/layers/additions.json'),
  readJson('data/layers/overrides.json'),
  readJson('data/layers/aliases.json'),
  readJson('data/sources.json'),
  readJson('data/layers/interconnect-rules.json'),
  readJson('data/layers/integrated-gpu-patterns.json'),
])

const catalog = buildCatalog({
  catalogVersion: '1.0.0',
  rightnow,
  additions,
  overrides,
  aliases,
  sources,
  interconnectRules,
  integratedGpuPatterns,
})
const artifacts = [
  ['dist/catalog.json', serialize(catalog)],
  ['dist/llmsizer.json', serialize(buildLlmsizerArtifact(catalog))],
]

if (process.argv.includes('--check')) {
  for (const [path, expected] of artifacts) {
    const actual = await readFile(resolve(root, path), 'utf8')
    if (actual !== expected) throw new Error(`${path} is out of date; run npm run build`)
  }
} else {
  await Promise.all(
    artifacts.map(([path, contents]) => writeFile(resolve(root, path), contents, 'utf8')),
  )
}

console.log(
  `Catalog ${catalog.catalog_version}: ${catalog.gpus.length} GPUs, ` +
  `${buildLlmsizerArtifact(catalog).gpus.length} llmsizer-compatible`,
)
