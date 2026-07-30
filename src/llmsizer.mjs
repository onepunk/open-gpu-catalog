const LLMSIZER_VENDORS = new Set(['apple', 'nvidia', 'amd', 'intel'])

export function buildLlmsizerArtifact(catalog) {
  const gpus = catalog.gpus
    .filter(gpu => {
      const capacity = gpu.memory.capacity_gb
      const bandwidth = gpu.memory.bandwidth_gbps
      return (
        LLMSIZER_VENDORS.has(gpu.vendor) &&
        typeof bandwidth === 'number' &&
        bandwidth > 0 &&
        (gpu.memory.unified || (typeof capacity === 'number' && capacity >= 1))
      )
    })
    .map(gpu => ({
      name: gpu.name,
      aliases: gpu.aliases,
      vendor: gpu.vendor,
      vram_gb: gpu.memory.unified ? null : gpu.memory.capacity_gb,
      bandwidth_gbps: gpu.memory.bandwidth_gbps,
      ...(gpu.memory.unified ? { unified: true } : {}),
      ...(gpu.interconnects.includes('nvlink') ? { nvlink: true } : {}),
    }))

  return {
    schema_version: '1.0.0',
    catalog_version: catalog.catalog_version,
    source_repository: 'https://github.com/onepunk/open-gpu-catalog',
    gpus,
    integrated_gpu_patterns: catalog.integrated_gpu_patterns,
  }
}
