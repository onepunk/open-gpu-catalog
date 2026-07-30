const RUNTIME_VENDORS = new Set(['apple', 'nvidia', 'amd', 'intel'])
const VENDOR_ORDER = new Map([
  ['nvidia', 0],
  ['amd', 1],
  ['intel', 2],
  ['apple', 3],
])

export function buildRuntimeArtifact(catalog) {
  const gpus = catalog.gpus
    .filter(gpu => {
      const capacity = gpu.memory.capacity_gb
      const bandwidth = gpu.memory.bandwidth_gbps
      return (
        RUNTIME_VENDORS.has(gpu.vendor) &&
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
    .sort((left, right) => {
      const vendorOrder =
        (VENDOR_ORDER.get(left.vendor) ?? 99) - (VENDOR_ORDER.get(right.vendor) ?? 99)
      return (
        vendorOrder ||
        right.bandwidth_gbps - left.bandwidth_gbps ||
        left.name.localeCompare(right.name)
      )
    })

  return {
    schema_version: '1.0.0',
    catalog_version: catalog.catalog_version,
    source_repository: 'https://github.com/onepunk/open-gpu-catalog',
    gpus,
    integrated_gpu_patterns: catalog.integrated_gpu_patterns,
  }
}
