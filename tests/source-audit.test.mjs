import assert from 'node:assert/strict'
import test from 'node:test'

async function loadAudit() {
  try {
    return await import('../scripts/audit-source-links.mjs')
  } catch {
    return {}
  }
}

test('source audit identifies primary, fallback-only, and missing coverage', async () => {
  const { auditSourceLinks } = await loadAudit()
  assert.equal(typeof auditSourceLinks, 'function', 'auditSourceLinks must be implemented')

  const report = auditSourceLinks({
    sources: [
      {
        id: 'amd',
        name: 'AMD product page',
        kind: 'vendor',
        url: 'https://www.amd.com/en/products/example.html',
      },
    ],
    gpus: [
      {
        id: 'vendor-backed',
        provenance: [
          { source_id: 'amd' },
          { source_id: 'import', source_url: 'https://www.techpowerup.com/gpu-specs/example.c1' },
        ],
      },
      {
        id: 'fallback-only',
        provenance: [
          { source_id: 'import', source_url: 'https://www.techpowerup.com/gpu-specs/example.c2' },
        ],
      },
      { id: 'missing', provenance: [] },
    ],
  })

  assert.deepEqual(report.coverage, {
    total: 3,
    primary: 1,
    fallback_only: 1,
    missing: 1,
  })
  assert.deepEqual(report.fallback_only_ids, ['fallback-only'])
  assert.deepEqual(report.missing_ids, ['missing'])
})
