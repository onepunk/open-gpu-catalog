import assert from 'node:assert/strict'
import test from 'node:test'

async function loadSearch() {
  try {
    const modulePath = '../site/search.mjs'
    const module = await import(modulePath)
    return module.searchCatalog
  } catch {
    return undefined
  }
}

const gpus = [
  {
    id: 'nvidia-vera-rubin',
    name: 'NVIDIA Vera Rubin GPU',
    aliases: ['NVIDIA Rubin GPU'],
    vendor: 'nvidia',
    device_type: 'accelerator',
    architecture: 'Rubin',
    generation: 'Vera Rubin',
    status: 'announced',
    memory: { capacity_gb: 288, bandwidth_gbps: 22000, unified: false },
  },
  {
    id: 'apple-m5-max',
    name: 'Apple M5 Max',
    aliases: ['Apple M5 Max GPU'],
    vendor: 'apple',
    device_type: 'soc',
    architecture: 'Apple Silicon M5',
    status: 'active',
    memory: { capacity_gb: 128, bandwidth_gbps: 614, unified: true },
  },
  {
    id: 'intel-arc-pro-b70',
    name: 'Intel Arc Pro B70 Graphics',
    aliases: ['Arc Pro B70'],
    vendor: 'intel',
    device_type: 'discrete',
    architecture: 'Xe2',
    status: 'active',
    memory: { capacity_gb: 32, bandwidth_gbps: 608, unified: false },
  },
  {
    id: 'amd-instinct-mi455x',
    name: 'AMD Instinct MI455X',
    aliases: ['MI455X'],
    vendor: 'amd',
    device_type: 'accelerator',
    architecture: 'CDNA 5',
    status: 'announced',
    memory: { capacity_gb: 432, bandwidth_gbps: 23300, unified: false },
  },
]

test('search matches case-insensitive tokens across aliases and architecture', async () => {
  const searchCatalog = await loadSearch()
  assert.equal(typeof searchCatalog, 'function', 'searchCatalog must be implemented')

  assert.deepEqual(
    searchCatalog(gpus, { query: 'rubin NVIDIA' }).map(gpu => gpu.id),
    ['nvidia-vera-rubin'],
  )
  assert.deepEqual(
    searchCatalog(gpus, { query: 'silicon m5' }).map(gpu => gpu.id),
    ['apple-m5-max'],
  )
  assert.deepEqual(
    searchCatalog(gpus, { query: 'arc b70' }).map(gpu => gpu.id),
    ['intel-arc-pro-b70'],
  )
})

test('search combines filters and applies deterministic sorting', async () => {
  const searchCatalog = await loadSearch()
  assert.equal(typeof searchCatalog, 'function', 'searchCatalog must be implemented')

  assert.deepEqual(
    searchCatalog(gpus, {
      deviceType: 'accelerator',
      memoryKind: 'dedicated',
      minMemory: 200,
      status: 'announced',
      sort: 'memory-desc',
    }).map(gpu => gpu.id),
    ['amd-instinct-mi455x', 'nvidia-vera-rubin'],
  )
  assert.deepEqual(
    searchCatalog(gpus, {
      vendor: 'apple',
      memoryKind: 'unified',
      status: 'active',
    }).map(gpu => gpu.id),
    ['apple-m5-max'],
  )
})

test('search state round-trips through compact URL parameters', async () => {
  const module = await import('../site/search.mjs')
  assert.equal(typeof module.readSearchState, 'function')
  assert.equal(typeof module.buildSearchParams, 'function')

  const state = module.readSearchState(
    '?q=Apple%20M5&vendor=apple&type=soc&memory=unified&min=16&status=active&sort=memory-desc',
  )
  assert.deepEqual(state, {
    query: 'Apple M5',
    vendor: 'apple',
    deviceType: 'soc',
    memoryKind: 'unified',
    minMemory: 16,
    status: 'active',
    sort: 'memory-desc',
  })
  assert.equal(
    module.buildSearchParams(state).toString(),
    'q=Apple+M5&vendor=apple&type=soc&memory=unified&min=16&status=active&sort=memory-desc',
  )
  assert.equal(module.buildSearchParams(module.readSearchState('')).toString(), '')
})
