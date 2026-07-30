const DBGPU_VENDORS = {
  NVIDIA: 'nvidia',
  AMD: 'amd',
  ATI: 'amd',
  Intel: 'intel',
  '3dfx': '3dfx',
  Matrox: 'matrox',
  XGI: 'xgi',
  Sony: 'sony',
}

function dbgpuId(gpu) {
  const vendor = DBGPU_VENDORS[gpu.manufacturer]
  if (!vendor) throw new Error(`unknown dbgpu manufacturer: ${gpu.manufacturer}`)
  const slug = gpu.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `${vendor}-${slug}`
}

function compactObject(entries) {
  const result = {}
  for (const [key, value] of entries) {
    if (value !== null && value !== undefined && value !== '') result[key] = value
  }
  return result
}

function apiVersion(major, minor) {
  if (major === null || major === undefined) return null
  return minor === null || minor === undefined ? String(major) : `${major}.${minor}`
}

function gflopsToTflops(value) {
  if (value === null || value === undefined) return null
  return Math.round(value) / 1000
}

function normalizeDbgpuSpecs(gpu) {
  const apis = compactObject([
    ['cuda', apiVersion(gpu.cuda_major_version, gpu.cuda_minor_version)],
    ['directx', apiVersion(gpu.directx_major_version, gpu.directx_minor_version)],
    ['opengl', apiVersion(gpu.opengl_major_version, gpu.opengl_minor_version)],
    ['vulkan', apiVersion(gpu.vulkan_major_version, gpu.vulkan_minor_version)],
    ['opencl', apiVersion(gpu.opencl_major_version, gpu.opencl_minor_version)],
    ['shader_model', apiVersion(gpu.shader_model_major_version, gpu.shader_model_minor_version)],
  ])
  const specs = compactObject([
    ['chip', gpu.gpu_name],
    ['foundry', gpu.foundry],
    ['process_nm', gpu.process_size_nm],
    ['transistors_b', gpu.transistor_count_m == null ? null : gpu.transistor_count_m / 1000],
    ['die_size_mm2', gpu.die_size_mm2],
    ['base_clock_mhz', gpu.base_clock_mhz],
    ['boost_clock_mhz', gpu.boost_clock_mhz],
    ['memory_clock_mhz', gpu.memory_clock_mhz],
    ['memory_bus_bits', gpu.memory_bus_bits],
    ['shading_units', gpu.shading_units],
    ['tensor_cores', gpu.tensor_cores],
    ['rt_cores', gpu.ray_tracing_cores],
    ['fp16_tflops', gflopsToTflops(gpu.half_float_performance_gflop_s)],
    ['fp32_tflops', gflopsToTflops(gpu.single_float_performance_gflop_s)],
    ['fp64_tflops', gflopsToTflops(gpu.double_float_performance_gflop_s)],
    ['tdp_w', gpu.thermal_design_power_w],
    ['bus_interface', gpu.bus_interface],
  ])
  if (Object.keys(apis).length) specs.apis = apis
  return Object.keys(specs).length ? specs : null
}

function normalizeDbgpuGpu(gpu) {
  const deviceType =
    gpu.board_slot_width === 'IGP' || gpu.memory_type === 'System Shared'
      ? 'integrated'
      : 'discrete'
  const capacity = gpu.memory_size_gb || null
  const specs = normalizeDbgpuSpecs(gpu)
  const fields = ['name', 'vendor', 'device_type']
  if (gpu.architecture) fields.push('architecture')
  if (gpu.generation) fields.push('generation')
  if (gpu.release_date) fields.push('release_date')
  if (capacity != null) fields.push('memory.capacity_gb')
  if (gpu.memory_type) fields.push('memory.type')
  if (gpu.memory_bandwidth_gb_s != null) fields.push('memory.bandwidth_gbps')
  if (specs) fields.push('specs')

  return {
    id: dbgpuId(gpu),
    name: gpu.name,
    vendor: DBGPU_VENDORS[gpu.manufacturer],
    device_type: deviceType,
    ...(gpu.architecture ? { architecture: gpu.architecture } : {}),
    ...(gpu.generation ? { generation: gpu.generation } : {}),
    ...(gpu.release_date ? { release_date: gpu.release_date } : {}),
    memory: {
      capacity_gb: capacity,
      ...(gpu.memory_type ? { type: gpu.memory_type } : {}),
      bandwidth_gbps: gpu.memory_bandwidth_gb_s ?? 0,
      unified: false,
    },
    ...(specs ? { specs } : {}),
    aliases: [],
    interconnects: [],
    status: 'unknown',
    provenance: [{
      source_id: 'dbgpu',
      ...(gpu.tpu_id ? { source_record_id: gpu.tpu_id } : {}),
      ...(gpu.tpu_url ? { source_url: gpu.tpu_url } : {}),
      fields,
    }],
  }
}

function mergeChanges(gpu, changes) {
  return {
    ...gpu,
    ...changes,
    memory: changes.memory ? { ...gpu.memory, ...changes.memory } : gpu.memory,
  }
}

export function buildCatalog({
  catalogVersion,
  dbgpu,
  additions,
  overrides,
  aliases,
  sources,
  interconnectRules = [],
  integratedGpuPatterns,
}) {
  const importedGpus = [
    ...dbgpu.map(normalizeDbgpuGpu),
    ...additions,
  ]
  const byId = new Map()

  for (const gpu of importedGpus) {
    if (byId.has(gpu.id)) throw new Error(`duplicate GPU id: ${gpu.id}`)
    byId.set(gpu.id, gpu)
  }

  for (const override of overrides) {
    const gpu = byId.get(override.target_id)
    if (!gpu) throw new Error(`override targets unknown GPU: ${override.target_id}`)

    byId.set(override.target_id, {
      ...mergeChanges(gpu, override.changes),
      provenance: [
        ...gpu.provenance,
        {
          source_id: override.source_id,
          fields: override.fields,
        },
      ],
    })
  }

  for (const alias of aliases) {
    const gpu = byId.get(alias.target_id)
    if (gpu) gpu.aliases = [...gpu.aliases, ...alias.aliases]
  }

  for (const rule of interconnectRules) {
    const namePatterns = rule.name_patterns.map(pattern => new RegExp(pattern, 'i'))
    const excludePatterns = rule.exclude_patterns.map(pattern => new RegExp(pattern, 'i'))
    for (const gpu of byId.values()) {
      if (
        gpu.vendor !== rule.vendor ||
        excludePatterns.some(pattern => pattern.test(gpu.name)) ||
        !namePatterns.some(pattern => pattern.test(gpu.name))
      ) {
        continue
      }

      gpu.interconnects = [...gpu.interconnects, rule.interconnect]
      gpu.provenance = [
        ...gpu.provenance,
        {
          source_id: rule.source_id,
          fields: ['interconnects'],
          method: 'derived-rule',
        },
      ]
    }
  }

  const sourceIds = new Set(sources.map(source => source.id))
  for (const gpu of byId.values()) {
    const capacity = gpu.memory.capacity_gb
    const bandwidth = gpu.memory.bandwidth_gbps
    if (
      capacity !== null &&
      (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0)
    ) {
      throw new Error(`invalid memory capacity for ${gpu.id}`)
    }
    if (
      bandwidth !== null &&
      (typeof bandwidth !== 'number' || !Number.isFinite(bandwidth) || bandwidth < 0)
    ) {
      throw new Error(`invalid memory bandwidth for ${gpu.id}`)
    }

    for (const provenance of gpu.provenance) {
      if (!sourceIds.has(provenance.source_id)) {
        throw new Error(`unknown provenance source: ${provenance.source_id}`)
      }
    }
  }

  const usedNames = new Set()
  for (const gpu of byId.values()) {
    for (const name of [gpu.name, ...gpu.aliases]) {
      const normalized = name.toLowerCase()
      if (usedNames.has(normalized)) {
        throw new Error(`catalog name or alias collision: ${name}`)
      }
      usedNames.add(normalized)
    }
  }

  return {
    schema_version: '1.0.0',
    catalog_version: catalogVersion,
    sources,
    gpus: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    integrated_gpu_patterns: integratedGpuPatterns,
  }
}
