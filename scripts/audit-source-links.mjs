import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildSourceLinks } from '../site/source-links.mjs'

export function auditSourceLinks(catalog) {
  const sources = new Map((catalog.sources ?? []).map(source => [source.id, source]))
  const coverage = {
    total: catalog.gpus.length,
    primary: 0,
    fallback_only: 0,
    missing: 0,
  }
  const fallbackOnlyIds = []
  const missingIds = []
  const destinationCounts = new Map()

  for (const gpu of catalog.gpus) {
    const links = buildSourceLinks(gpu, sources)
    for (const link of links) {
      destinationCounts.set(link.label, (destinationCounts.get(link.label) ?? 0) + 1)
    }

    if (links.some(link => link.primary)) {
      coverage.primary += 1
    } else if (links.length) {
      coverage.fallback_only += 1
      fallbackOnlyIds.push(gpu.id)
    } else {
      coverage.missing += 1
      missingIds.push(gpu.id)
    }
  }

  return {
    coverage,
    destinations: Object.fromEntries(
      [...destinationCounts].sort(([left], [right]) => left.localeCompare(right)),
    ),
    fallback_only_ids: fallbackOnlyIds,
    missing_ids: missingIds,
  }
}

async function run() {
  const catalogPath = resolve(import.meta.dirname, '../dist/catalog.json')
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const report = auditSourceLinks(catalog)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const { coverage } = report
  const primaryPercent = coverage.total
    ? ((coverage.primary / coverage.total) * 100).toFixed(1)
    : '0.0'
  console.log(`Source-link coverage for ${coverage.total.toLocaleString()} GPUs`)
  console.log(`  At least one vendor source: ${coverage.primary.toLocaleString()} (${primaryPercent}%)`)
  console.log(`  Specific fallback only: ${coverage.fallback_only.toLocaleString()}`)
  console.log(`  Missing source link: ${coverage.missing.toLocaleString()}`)
  console.log('Destinations')
  for (const [label, count] of Object.entries(report.destinations)) {
    console.log(`  ${label}: ${count.toLocaleString()}`)
  }
  console.log('Run with --json to list records that need vendor-source enrichment.')
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (entryPath === import.meta.url) await run()
