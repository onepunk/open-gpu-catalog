import assert from 'node:assert/strict'
import test from 'node:test'

async function loadBuildCatalog() {
  try {
    const module = await import('../src/catalog.mjs')
    return module.buildCatalog
  } catch {
    return undefined
  }
}

test('vendor override wins while preserving field-level provenance', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const catalog = buildCatalog({
    catalogVersion: '1.0.0',
    rightnow: [{
      id: 'nvidia-b200',
      name: 'B200',
      vendor: 'nvidia',
      architecture: 'Blackwell',
      generation: 'Server Blackwell',
      releaseDate: '2024-03-18',
      memorySize: 192,
      memoryType: 'HBM3e',
      memoryBandwidth: 7600,
      url: 'https://example.test/community/b200',
    }],
    additions: [],
    overrides: [{
      target_id: 'nvidia-b200',
      source_id: 'nvidia-hgx-b-series',
      changes: {
        memory: {
          capacity_gb: 180,
          bandwidth_gbps: 8000,
        },
      },
      fields: ['memory.capacity_gb', 'memory.bandwidth_gbps'],
    }],
    aliases: [],
    sources: [
      {
        id: 'rightnow-gpu-database',
        name: 'RightNow GPU Database',
        kind: 'community',
        url: 'https://github.com/RightNow-AI/RightNow-GPU-Database',
      },
      {
        id: 'nvidia-hgx-b-series',
        name: 'NVIDIA HGX AI Factory documentation',
        kind: 'vendor',
        url: 'https://docs.nvidia.com/',
      },
    ],
    integratedGpuPatterns: [],
  })

  assert.equal(catalog.gpus[0].memory.capacity_gb, 180)
  assert.equal(catalog.gpus[0].memory.bandwidth_gbps, 8000)
  assert.equal(catalog.gpus[0].device_type, 'discrete')
  assert.equal(catalog.gpus[0].generation, 'Server Blackwell')
  assert.equal(catalog.gpus[0].release_date, '2024-03-18')
  assert.deepEqual(catalog.gpus[0].provenance, [
    {
      source_id: 'rightnow-gpu-database',
      source_record_id: 'nvidia-b200',
      source_url: 'https://example.test/community/b200',
      fields: [
        'name',
        'vendor',
        'device_type',
        'architecture',
        'generation',
        'release_date',
        'memory.capacity_gb',
        'memory.type',
        'memory.bandwidth_gbps',
      ],
    },
    {
      source_id: 'nvidia-hgx-b-series',
      fields: ['memory.capacity_gb', 'memory.bandwidth_gbps'],
    },
  ])
})

test('duplicate canonical GPU IDs are rejected instead of silently overwritten', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const duplicate = {
    id: 'nvidia-b200',
    name: 'B200',
    vendor: 'nvidia',
    memorySize: 180,
    memoryBandwidth: 8000,
  }

  assert.throws(
    () => buildCatalog({
      catalogVersion: '1.0.0',
      rightnow: [duplicate, { ...duplicate, name: 'Duplicate B200' }],
      additions: [],
      overrides: [],
      aliases: [],
      sources: [],
      integratedGpuPatterns: [],
    }),
    /duplicate GPU id: nvidia-b200/,
  )
})

test('an override targeting an unknown GPU is rejected', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  assert.throws(
    () => buildCatalog({
      catalogVersion: '1.0.0',
      rightnow: [],
      additions: [],
      overrides: [{
        target_id: 'nvidia-missing',
        source_id: 'nvidia',
        changes: { memory: { capacity_gb: 1 } },
        fields: ['memory.capacity_gb'],
      }],
      aliases: [],
      sources: [],
      integratedGpuPatterns: [],
    }),
    /override targets unknown GPU: nvidia-missing/,
  )
})

test('every provenance source must resolve to the source registry', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  assert.throws(
    () => buildCatalog({
      catalogVersion: '1.0.0',
      rightnow: [{
        id: 'nvidia-b200',
        name: 'B200',
        vendor: 'nvidia',
        memorySize: 180,
        memoryBandwidth: 8000,
      }],
      additions: [],
      overrides: [{
        target_id: 'nvidia-b200',
        source_id: 'missing-vendor-source',
        changes: { memory: { capacity_gb: 180 } },
        fields: ['memory.capacity_gb'],
      }],
      aliases: [],
      sources: [{
        id: 'rightnow-gpu-database',
        name: 'RightNow GPU Database',
        kind: 'community',
        url: 'https://example.test/rightnow',
      }],
      integratedGpuPatterns: [],
    }),
    /unknown provenance source: missing-vendor-source/,
  )
})

test('aliases cannot collide with another canonical GPU name', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')
  const source = {
    id: 'vendor',
    name: 'Vendor',
    kind: 'vendor',
    url: 'https://example.test/vendor',
  }
  const gpu = (id, name) => ({
    id,
    name,
    vendor: 'apple',
    memory: { capacity_gb: null, bandwidth_gbps: 100, unified: true },
    aliases: [],
    interconnects: [],
    status: 'active',
    provenance: [{ source_id: 'vendor', fields: ['name'] }],
  })

  assert.throws(
    () => buildCatalog({
      catalogVersion: '1.0.0',
      rightnow: [],
      additions: [gpu('apple-m4', 'Apple M4'), gpu('apple-m5', 'Apple M5')],
      overrides: [],
      aliases: [{ target_id: 'apple-m4', aliases: ['Apple M5'] }],
      sources: [source],
      integratedGpuPatterns: [],
    }),
    /catalog name or alias collision: Apple M5/,
  )
})

test('catalog records are emitted in stable canonical ID order', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const catalog = buildCatalog({
    catalogVersion: '1.0.0',
    rightnow: [
      {
        id: 'nvidia-z',
        name: 'Z',
        vendor: 'nvidia',
        memorySize: 1,
        memoryBandwidth: 1,
      },
      {
        id: 'amd-a',
        name: 'A',
        vendor: 'amd',
        memorySize: 1,
        memoryBandwidth: 1,
      },
    ],
    additions: [],
    overrides: [],
    aliases: [],
    sources: [{
      id: 'rightnow-gpu-database',
      name: 'RightNow GPU Database',
      kind: 'community',
      url: 'https://example.test/rightnow',
    }],
    integratedGpuPatterns: [],
  })

  assert.deepEqual(catalog.gpus.map(gpu => gpu.id), ['amd-a', 'nvidia-z'])
})

test('interconnect rules add NVLink but exclude laptop variants', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const catalog = buildCatalog({
    catalogVersion: '1.0.0',
    rightnow: [
      {
        id: 'nvidia-b200',
        name: 'B200',
        vendor: 'nvidia',
        memorySize: 180,
        memoryBandwidth: 8000,
      },
      {
        id: 'nvidia-b200-mobile',
        name: 'B200 Mobile',
        vendor: 'nvidia',
        memorySize: 180,
        memoryBandwidth: 8000,
      },
    ],
    additions: [],
    overrides: [],
    aliases: [],
    sources: [
      {
        id: 'rightnow-gpu-database',
        name: 'RightNow GPU Database',
        kind: 'community',
        url: 'https://example.test/rightnow',
      },
      {
        id: 'nvidia-nvlink-product-documentation',
        name: 'NVIDIA NVLink product documentation',
        kind: 'vendor',
        url: 'https://example.test/nvlink',
      },
    ],
    interconnectRules: [{
      vendor: 'nvidia',
      interconnect: 'nvlink',
      source_id: 'nvidia-nvlink-product-documentation',
      name_patterns: ['^B200\\b'],
      exclude_patterns: ['Mobile'],
    }],
    integratedGpuPatterns: [],
  })

  const byId = Object.fromEntries(catalog.gpus.map(gpu => [gpu.id, gpu]))
  assert.deepEqual(byId['nvidia-b200'].interconnects, ['nvlink'])
  assert.deepEqual(byId['nvidia-b200-mobile'].interconnects, [])
  assert.deepEqual(byId['nvidia-b200'].provenance.at(-1), {
    source_id: 'nvidia-nvlink-product-documentation',
    fields: ['interconnects'],
    method: 'derived-rule',
  })
})

test('invalid memory specifications are rejected', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  assert.throws(
    () => buildCatalog({
      catalogVersion: '1.0.0',
      rightnow: [],
      additions: [{
        id: 'vendor-bad-gpu',
        name: 'Bad GPU',
        vendor: 'vendor',
        device_type: 'discrete',
        memory: {
          capacity_gb: 16,
          bandwidth_gbps: -1,
          unified: false,
        },
        aliases: [],
        interconnects: [],
        status: 'unknown',
        provenance: [{ source_id: 'vendor', fields: ['name'] }],
      }],
      overrides: [],
      aliases: [],
      sources: [{
        id: 'vendor',
        name: 'Vendor',
        kind: 'vendor',
        url: 'https://example.test/vendor',
      }],
      integratedGpuPatterns: [],
    }),
    /invalid memory bandwidth for vendor-bad-gpu/,
  )
})
