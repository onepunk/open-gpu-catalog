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

const DBGPU_SOURCE = {
  id: 'dbgpu',
  name: 'dbgpu TechPowerUp dataset',
  kind: 'community',
  url: 'https://github.com/painebenjamin/dbgpu',
}

test('vendor override wins while preserving field-level provenance', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const catalog = buildCatalog({
    catalogVersion: '1.0.0',
    dbgpu: [{
      manufacturer: 'NVIDIA',
      name: 'B200',
      architecture: 'Blackwell',
      generation: 'Server Blackwell',
      release_date: '2024-03-18',
      memory_size_gb: 192,
      memory_type: 'HBM3e',
      memory_bandwidth_gb_s: 7600,
      tpu_id: 'c4210',
      tpu_url: 'https://example.test/community/b200',
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
      DBGPU_SOURCE,
      {
        id: 'nvidia-hgx-b-series',
        name: 'NVIDIA HGX AI Factory documentation',
        kind: 'vendor',
        url: 'https://docs.nvidia.com/',
      },
    ],
    integratedGpuPatterns: [],
  })

  assert.equal(catalog.gpus[0].id, 'nvidia-b200')
  assert.equal(catalog.gpus[0].memory.capacity_gb, 180)
  assert.equal(catalog.gpus[0].memory.bandwidth_gbps, 8000)
  assert.equal(catalog.gpus[0].device_type, 'discrete')
  assert.equal(catalog.gpus[0].generation, 'Server Blackwell')
  assert.equal(catalog.gpus[0].release_date, '2024-03-18')
  assert.deepEqual(catalog.gpus[0].provenance, [
    {
      source_id: 'dbgpu',
      source_record_id: 'c4210',
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

test('extended specifications are normalized with unit conversions', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const catalog = buildCatalog({
    catalogVersion: '1.0.0',
    dbgpu: [{
      manufacturer: 'NVIDIA',
      name: 'B200',
      memory_size_gb: 192,
      memory_bandwidth_gb_s: 7600,
      gpu_name: 'GB100',
      foundry: 'TSMC',
      process_size_nm: 5,
      transistor_count_m: 92200,
      die_size_mm2: 750,
      base_clock_mhz: 2017,
      boost_clock_mhz: 2407,
      memory_bus_bits: 512,
      shading_units: 21760,
      tensor_cores: 680,
      ray_tracing_cores: 170,
      single_float_performance_gflop_s: 104800,
      double_float_performance_gflop_s: 1637.2,
      thermal_design_power_w: 575,
      bus_interface: 'PCIe 5.0 x16',
      cuda_major_version: 12,
      cuda_minor_version: 0,
      directx_major_version: 12,
      directx_minor_version: 2,
      vulkan_major_version: 1,
      vulkan_minor_version: 4,
    }],
    additions: [],
    overrides: [],
    aliases: [],
    sources: [DBGPU_SOURCE],
    integratedGpuPatterns: [],
  })

  const gpu = catalog.gpus[0]
  assert.equal(gpu.specs.chip, 'GB100')
  assert.equal(gpu.specs.transistors_b, 92.2)
  assert.equal(gpu.specs.fp32_tflops, 104.8)
  assert.equal(gpu.specs.fp64_tflops, 1.637)
  assert.equal(gpu.specs.tdp_w, 575)
  assert.deepEqual(gpu.specs.apis, {
    cuda: '12.0',
    directx: '12.2',
    vulkan: '1.4',
  })
  assert.ok(gpu.provenance[0].fields.includes('specs'))
})

test('integrated GPUs are detected and zero capacities become unknown', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const catalog = buildCatalog({
    catalogVersion: '1.0.0',
    dbgpu: [{
      manufacturer: 'Intel',
      name: 'i740 Graphics',
      board_slot_width: 'IGP',
      memory_type: 'System Shared',
      memory_size_gb: 0,
      memory_bandwidth_gb_s: 0.4,
    }],
    additions: [],
    overrides: [],
    aliases: [],
    sources: [DBGPU_SOURCE],
    integratedGpuPatterns: [],
  })

  assert.equal(catalog.gpus[0].id, 'intel-i740-graphics')
  assert.equal(catalog.gpus[0].device_type, 'integrated')
  assert.equal(catalog.gpus[0].memory.capacity_gb, null)
})

test('duplicate canonical GPU IDs are rejected instead of silently overwritten', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const duplicate = {
    manufacturer: 'NVIDIA',
    name: 'B200',
    memory_size_gb: 180,
    memory_bandwidth_gb_s: 8000,
  }

  assert.throws(
    () => buildCatalog({
      catalogVersion: '1.0.0',
      dbgpu: [duplicate, { ...duplicate }],
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
      dbgpu: [],
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
      dbgpu: [{
        manufacturer: 'NVIDIA',
        name: 'B200',
        memory_size_gb: 180,
        memory_bandwidth_gb_s: 8000,
      }],
      additions: [],
      overrides: [{
        target_id: 'nvidia-b200',
        source_id: 'missing-vendor-source',
        changes: { memory: { capacity_gb: 180 } },
        fields: ['memory.capacity_gb'],
      }],
      aliases: [],
      sources: [DBGPU_SOURCE],
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
      dbgpu: [],
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
    dbgpu: [
      {
        manufacturer: 'NVIDIA',
        name: 'Z',
        memory_size_gb: 1,
        memory_bandwidth_gb_s: 1,
      },
      {
        manufacturer: 'AMD',
        name: 'A',
        memory_size_gb: 1,
        memory_bandwidth_gb_s: 1,
      },
    ],
    additions: [],
    overrides: [],
    aliases: [],
    sources: [DBGPU_SOURCE],
    integratedGpuPatterns: [],
  })

  assert.deepEqual(catalog.gpus.map(gpu => gpu.id), ['amd-a', 'nvidia-z'])
})

test('interconnect rules add NVLink but exclude laptop variants', async () => {
  const buildCatalog = await loadBuildCatalog()
  assert.equal(typeof buildCatalog, 'function', 'buildCatalog must be implemented')

  const catalog = buildCatalog({
    catalogVersion: '1.0.0',
    dbgpu: [
      {
        manufacturer: 'NVIDIA',
        name: 'B200',
        memory_size_gb: 180,
        memory_bandwidth_gb_s: 8000,
      },
      {
        manufacturer: 'NVIDIA',
        name: 'B200 Mobile',
        memory_size_gb: 180,
        memory_bandwidth_gb_s: 8000,
      },
    ],
    additions: [],
    overrides: [],
    aliases: [],
    sources: [
      DBGPU_SOURCE,
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
      dbgpu: [],
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
