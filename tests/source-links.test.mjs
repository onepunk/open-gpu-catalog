import assert from 'node:assert/strict'
import test from 'node:test'

async function loadSourceLinks() {
  try {
    return await import('../site/source-links.mjs')
  } catch {
    return {}
  }
}

test('a record-level source URL is labelled by its direct destination', async () => {
  const { buildSourceLinks } = await loadSourceLinks()
  assert.equal(typeof buildSourceLinks, 'function', 'buildSourceLinks must be implemented')

  const links = buildSourceLinks(
    {
      provenance: [{
        source_id: 'community-import',
        source_url: 'https://www.techpowerup.com/gpu-specs/geforce-rtx-5090.c4216',
      }],
    },
    new Map([[
      'community-import',
      {
        id: 'community-import',
        name: 'Upstream database',
        kind: 'community',
        url: 'https://github.com/example/database',
      },
    ]]),
  )

  assert.deepEqual(links, [{
    label: 'TechPowerUp specification',
    url: 'https://www.techpowerup.com/gpu-specs/geforce-rtx-5090.c4216',
    primary: false,
  }])
})

test('vendor documentation is preferred while exact links are deduplicated', async () => {
  const { buildSourceLinks } = await loadSourceLinks()
  assert.equal(typeof buildSourceLinks, 'function', 'buildSourceLinks must be implemented')

  const directSpecification = 'https://www.techpowerup.com/gpu-specs/radeon-ai-pro-r9700.c4257'
  const links = buildSourceLinks(
    {
      provenance: [
        { source_id: 'community-import', source_url: directSpecification },
        { source_id: 'amd-product' },
        { source_id: 'community-import', source_url: directSpecification },
        { source_id: 'missing' },
      ],
    },
    new Map([
      ['community-import', {
        id: 'community-import',
        name: 'Upstream database',
        kind: 'community',
        url: 'https://github.com/example/database',
      }],
      ['amd-product', {
        id: 'amd-product',
        name: 'AMD product page',
        kind: 'vendor',
        url: 'https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro-r9700.html',
      }],
    ]),
  )

  assert.deepEqual(links, [
    {
      label: 'AMD product page',
      url: 'https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro-r9700.html',
      primary: true,
    },
    {
      label: 'TechPowerUp specification',
      url: directSpecification,
      primary: false,
    },
  ])
})
