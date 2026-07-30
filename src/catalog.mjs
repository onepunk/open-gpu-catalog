function normalizeRightNowGpu(gpu) {
  const deviceType =
    gpu.slot === 'IGP' || gpu.memoryType === 'System Shared' ? 'integrated' : 'discrete'
  const fields = ['name', 'vendor', 'device_type']
  if (gpu.architecture) fields.push('architecture')
  if (gpu.generation) fields.push('generation')
  if (gpu.releaseDate) fields.push('release_date')
  if (gpu.memorySize != null) fields.push('memory.capacity_gb')
  if (gpu.memoryType) fields.push('memory.type')
  if (gpu.memoryBandwidth != null) fields.push('memory.bandwidth_gbps')

  return {
    id: gpu.id,
    name: gpu.name,
    vendor: gpu.vendor,
    device_type: deviceType,
    ...(gpu.architecture ? { architecture: gpu.architecture } : {}),
    ...(gpu.generation ? { generation: gpu.generation } : {}),
    ...(gpu.releaseDate ? { release_date: gpu.releaseDate } : {}),
    memory: {
      capacity_gb: gpu.memorySize ?? null,
      ...(gpu.memoryType ? { type: gpu.memoryType } : {}),
      bandwidth_gbps: gpu.memoryBandwidth ?? 0,
      unified: false,
    },
    aliases: [],
    interconnects: [],
    status: 'unknown',
    provenance: [{
      source_id: 'rightnow-gpu-database',
      source_record_id: gpu.id,
      ...(gpu.url ? { source_url: gpu.url } : {}),
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
  rightnow,
  additions,
  overrides,
  aliases,
  sources,
  interconnectRules = [],
  integratedGpuPatterns,
}) {
  const importedGpus = [
    ...rightnow.map(normalizeRightNowGpu),
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
