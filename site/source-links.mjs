const DESTINATIONS = [
  { domain: 'techpowerup.com', label: 'TechPowerUp specification', primary: false },
  { domain: 'nvidia.com', label: 'NVIDIA documentation', primary: true },
  { domain: 'amd.com', label: 'AMD documentation', primary: true },
  { domain: 'intel.com', label: 'Intel documentation', primary: true },
  { domain: 'apple.com', label: 'Apple documentation', primary: true },
  { domain: 'github.com', label: 'GitHub source', primary: false },
]

function destinationFor(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null

  const hostname = parsed.hostname.toLocaleLowerCase().replace(/^www\./, '')
  const known = DESTINATIONS.find(destination =>
    hostname === destination.domain || hostname.endsWith(`.${destination.domain}`),
  )

  return {
    label: known?.label ?? hostname,
    primary: known?.primary ?? false,
  }
}

export function buildSourceLinks(gpu, sources) {
  const links = new Map()

  for (const item of gpu.provenance ?? []) {
    const source = sources.get(item.source_id)
    const url = item.source_url ?? source?.url
    if (!url) continue

    const destination = destinationFor(url)
    if (!destination) continue

    const candidate = {
      label: !item.source_url && source?.kind === 'vendor' && source.name
        ? source.name
        : destination.label,
      url,
      primary: destination.primary || source?.kind === 'vendor',
    }
    const existing = links.get(url)
    if (!existing || candidate.primary) links.set(url, candidate)
  }

  return [...links.values()].sort((left, right) =>
    Number(right.primary) - Number(left.primary) ||
    left.label.localeCompare(right.label) ||
    left.url.localeCompare(right.url),
  )
}
