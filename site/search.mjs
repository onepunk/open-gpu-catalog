function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function readSearchState(search = '') {
  const params = new URLSearchParams(search)
  return {
    query: params.get('q') ?? '',
    vendor: params.get('vendor') ?? 'all',
    deviceType: params.get('type') ?? 'all',
    memoryKind: params.get('memory') ?? 'all',
    minMemory: Number(params.get('min')) || 0,
    status: params.get('status') ?? 'all',
    sort: params.get('sort') ?? 'name-asc',
  }
}

export function buildSearchParams(state) {
  const params = new URLSearchParams()
  const query = String(state.query ?? '').trim()
  if (query) params.set('q', query)
  if (state.vendor && state.vendor !== 'all') params.set('vendor', state.vendor)
  if (state.deviceType && state.deviceType !== 'all') params.set('type', state.deviceType)
  if (state.memoryKind && state.memoryKind !== 'all') params.set('memory', state.memoryKind)
  if (Number(state.minMemory) > 0) params.set('min', String(Number(state.minMemory)))
  if (state.status && state.status !== 'all') params.set('status', state.status)
  if (state.sort && state.sort !== 'name-asc') params.set('sort', state.sort)
  return params
}

export function searchCatalog(gpus, {
  query = '',
  vendor = 'all',
  deviceType = 'all',
  memoryKind = 'all',
  minMemory = 0,
  status = 'all',
  sort = 'name-asc',
} = {}) {
  const tokens = normalize(query).split(' ').filter(Boolean)
  const minimum = Number(minMemory) || 0

  return gpus
    .filter(gpu => {
      const searchable = normalize([
        gpu.name,
        ...(gpu.aliases ?? []),
        gpu.vendor,
        gpu.architecture,
        gpu.generation,
      ].join(' '))
      const matchesQuery = tokens.every(token => searchable.includes(token))
      const matchesMemoryKind =
        memoryKind === 'all' ||
        (memoryKind === 'unified' && gpu.memory.unified) ||
        (memoryKind === 'dedicated' && !gpu.memory.unified)

      return (
        matchesQuery &&
        (vendor === 'all' || gpu.vendor === vendor) &&
        (deviceType === 'all' || gpu.device_type === deviceType) &&
        (status === 'all' || gpu.status === status) &&
        matchesMemoryKind &&
        (gpu.memory.capacity_gb ?? 0) >= minimum
      )
    })
    .sort((left, right) => {
      const nameOrder = left.name.localeCompare(right.name)
      if (sort === 'memory-desc') {
        return (right.memory.capacity_gb ?? -1) - (left.memory.capacity_gb ?? -1) || nameOrder
      }
      if (sort === 'bandwidth-desc') {
        return (
          (right.memory.bandwidth_gbps ?? -1) - (left.memory.bandwidth_gbps ?? -1) ||
          nameOrder
        )
      }
      if (sort === 'newest') {
        return (right.release_date ?? '').localeCompare(left.release_date ?? '') || nameOrder
      }
      return nameOrder
    })
}
