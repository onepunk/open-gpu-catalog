import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const excludedDirectories = new Set([
  '.git',
  '.pages',
  '.claude-octopus',
  'node_modules',
])
const retiredNames = [
  ['open', 'gpu', 'catalog'].join('-'),
  ['open', 'gpu', 'catalog'].join(' '),
]

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async entry => {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) return []
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))
  return paths.flat()
}

test('current repository identity is Open GPU DB', async () => {
  const offenders = []
  for (const path of await listFiles(root)) {
    const repositoryPath = relative(root, path)
    const contents = await readFile(path, 'utf8')
    const searchable = `${repositoryPath}\n${contents}`.toLocaleLowerCase()
    if (retiredNames.some(name => searchable.includes(name))) {
      offenders.push(repositoryPath)
    }
  }

  assert.deepEqual(offenders, [])
})
