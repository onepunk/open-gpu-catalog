import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const excludedDirectories = new Set(['.git', '.claude-octopus', 'node_modules'])
const forbiddenNames = [
  ['llm', 'sizer'].join(''),
  String.fromCodePoint(
    119, 105, 108, 108, 105, 97, 109, 32, 118, 97, 114, 103, 111,
  ),
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

test('repository content and paths remain consumer agnostic', async () => {
  const offenders = []
  for (const path of await listFiles(root)) {
    const repositoryPath = relative(root, path)
    const normalizedPath = repositoryPath.toLowerCase()
    if (forbiddenNames.some(name => normalizedPath.includes(name))) {
      offenders.push(repositoryPath)
      continue
    }

    const contents = await readFile(path, 'utf8')
    const normalizedContents = contents.toLowerCase()
    if (forbiddenNames.some(name => normalizedContents.includes(name))) {
      offenders.push(repositoryPath)
    }
  }

  assert.deepEqual(offenders, [])
})
