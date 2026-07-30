import { searchCatalog } from './search.mjs'
import { buildSearchParams, readSearchState } from './search.mjs'
import { buildSourceLinks } from './source-links.mjs'

const PAGE_SIZE = 50

const elements = {
  form: document.querySelector('#catalog-filters'),
  search: document.querySelector('#catalog-search'),
  vendor: document.querySelector('#vendor-filter'),
  deviceType: document.querySelector('#type-filter'),
  memoryKind: document.querySelector('#memory-filter'),
  minMemory: document.querySelector('#capacity-filter'),
  status: document.querySelector('#status-filter'),
  sort: document.querySelector('#sort-filter'),
  activeFilterSummary: document.querySelector('#active-filter-summary'),
  resultStatus: document.querySelector('#result-status'),
  loading: document.querySelector('#loading-state'),
  error: document.querySelector('#error-state'),
  empty: document.querySelector('#empty-state'),
  results: document.querySelector('#results'),
  rows: document.querySelector('#result-rows'),
  cards: document.querySelector('#result-cards'),
  showMore: document.querySelector('#show-more'),
  gpuCount: document.querySelector('#gpu-count'),
}

let catalog = null
let sources = new Map()
let visibleCount = PAGE_SIZE

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName)
  if (options.className) element.className = options.className
  if (options.text !== undefined) element.textContent = options.text
  if (options.title) element.title = options.title
  return element
}

function formatName(value) {
  if (!value) return 'Unknown'
  if (value === 'soc') return 'System on chip'
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function formatCapacity(gpu) {
  const capacity = gpu.memory.capacity_gb
  if (capacity === null || capacity === undefined) return 'Unknown'

  const formatted = new Intl.NumberFormat('en', {
    maximumFractionDigits: capacity < 1 ? 3 : 1,
  }).format(capacity)
  return `${formatted} GB`
}

function memoryDescription(gpu) {
  const kind = gpu.memory.unified ? 'unified max' : 'dedicated'
  return `${formatCapacity(gpu)} ${kind}`
}

function formatBandwidth(value) {
  if (value === null || value === undefined) return 'Unknown'
  if (value >= 1000) {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value / 1000)} TB/s`
  }
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)} GB/s`
}

function createStatus(status) {
  return createElement('span', {
    className: `status-pill status-${status ?? 'unknown'}`,
    text: formatName(status),
  })
}

function provenanceLinks(gpu) {
  const container = createElement('div', { className: 'source-links' })

  for (const sourceLink of buildSourceLinks(gpu, sources)) {
    const link = createElement('a', {
      className: sourceLink.primary ? 'source-primary' : '',
      text: sourceLink.label,
      title: sourceLink.url,
    })
    link.href = sourceLink.url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    container.append(link)
  }

  if (!container.childElementCount) {
    container.append(createElement('span', { text: 'No linked source' }))
  }
  return container
}

function createDetails(gpu) {
  const details = createElement('details', { className: 'record-details' })
  details.append(createElement('summary', { text: 'Aliases & sources' }))

  const block = createElement('div', { className: 'detail-block' })
  const aliases = createElement('p', {
    text: gpu.aliases?.length ? `Aliases: ${gpu.aliases.join(', ')}` : 'Aliases: none recorded',
  })
  block.append(aliases, provenanceLinks(gpu))
  details.append(block)
  return details
}

function createNameCell(gpu) {
  const cell = createElement('td', { className: 'gpu-name' })
  cell.append(
    createElement('strong', { text: gpu.name }),
    createElement('span', { className: 'gpu-id', text: gpu.id }),
    createDetails(gpu),
  )
  return cell
}

function createSpecCell(primary, secondary, className = '') {
  const cell = createElement('td', { className })
  cell.append(createElement('span', { className: 'spec-value', text: primary }))
  if (secondary) {
    cell.append(createElement('span', { className: 'spec-subtle', text: secondary }))
  }
  return cell
}

function createRow(gpu) {
  const row = document.createElement('tr')
  const vendor = createElement('td', {
    className: 'vendor-name',
    text: formatName(gpu.vendor),
  })
  const type = createElement('td', {
    className: 'type-name',
    text: formatName(gpu.device_type),
  })
  const bandwidth = createSpecCell(
    formatBandwidth(gpu.memory.bandwidth_gbps),
    gpu.memory.bandwidth_gbps === null || gpu.memory.bandwidth_gbps === undefined
      ? ''
      : `${gpu.memory.bandwidth_gbps} GB/s published`,
  )
  const architecture = createSpecCell(
    gpu.architecture ?? gpu.generation ?? 'Unknown',
    gpu.architecture && gpu.generation && gpu.architecture !== gpu.generation
      ? gpu.generation
      : '',
  )
  const status = document.createElement('td')
  status.append(createStatus(gpu.status))

  row.append(
    createNameCell(gpu),
    vendor,
    type,
    createSpecCell(memoryDescription(gpu), gpu.memory.type),
    bandwidth,
    architecture,
    status,
  )
  return row
}

function cardSpec(label, value) {
  const wrapper = document.createElement('div')
  wrapper.append(
    createElement('dt', { text: label }),
    createElement('dd', { text: value }),
  )
  return wrapper
}

function createCard(gpu) {
  const card = createElement('article', { className: 'gpu-card' })
  const header = createElement('div', { className: 'gpu-card-header' })
  const identity = document.createElement('div')
  identity.append(
    createElement('h3', { text: gpu.name }),
    createElement('span', { className: 'gpu-id', text: gpu.id }),
  )
  header.append(identity, createStatus(gpu.status))

  const specs = createElement('dl', { className: 'card-specs' })
  specs.append(
    cardSpec('Vendor', formatName(gpu.vendor)),
    cardSpec('Type', formatName(gpu.device_type)),
    cardSpec('Memory', memoryDescription(gpu)),
    cardSpec('Bandwidth', formatBandwidth(gpu.memory.bandwidth_gbps)),
    cardSpec('Architecture', gpu.architecture ?? gpu.generation ?? 'Unknown'),
    cardSpec('Released', gpu.release_date ?? 'Unknown'),
  )

  card.append(header, specs, createDetails(gpu))
  return card
}

function currentState() {
  return {
    query: elements.search.value,
    vendor: elements.vendor.value,
    deviceType: elements.deviceType.value,
    memoryKind: elements.memoryKind.value,
    minMemory: Number(elements.minMemory.value),
    status: elements.status.value,
    sort: elements.sort.value,
  }
}

function updateUrl(state) {
  const params = buildSearchParams(state).toString()
  const url = params ? `${window.location.pathname}?${params}` : window.location.pathname
  window.history.replaceState(null, '', `${url}${window.location.hash}`)
}

function render() {
  if (!catalog) return

  const state = currentState()
  const matches = searchCatalog(catalog.gpus, state)
  const visible = matches.slice(0, visibleCount)
  const fragmentRows = document.createDocumentFragment()
  const fragmentCards = document.createDocumentFragment()

  for (const gpu of visible) {
    fragmentRows.append(createRow(gpu))
    fragmentCards.append(createCard(gpu))
  }

  elements.rows.replaceChildren(fragmentRows)
  elements.cards.replaceChildren(fragmentCards)
  elements.empty.hidden = matches.length !== 0
  elements.results.hidden = matches.length === 0
  elements.showMore.hidden = visible.length >= matches.length
  elements.resultStatus.textContent = matches.length === catalog.gpus.length
    ? `${matches.length.toLocaleString()} GPUs`
    : `${matches.length.toLocaleString()} of ${catalog.gpus.length.toLocaleString()} GPUs`

  const activeCount = [
    state.query.trim(),
    state.vendor !== 'all',
    state.deviceType !== 'all',
    state.memoryKind !== 'all',
    state.minMemory > 0,
    state.status !== 'all',
  ].filter(Boolean).length
  elements.activeFilterSummary.textContent = activeCount
    ? `${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}`
    : 'Showing the complete catalog'

  updateUrl(state)
}

function populateVendors(gpus) {
  const counts = new Map()
  for (const gpu of gpus) {
    counts.set(gpu.vendor, (counts.get(gpu.vendor) ?? 0) + 1)
  }

  for (const [vendor, count] of [...counts].sort(([left], [right]) => left.localeCompare(right))) {
    const option = createElement('option', {
      text: `${formatName(vendor)} (${count.toLocaleString()})`,
    })
    option.value = vendor
    elements.vendor.append(option)
  }
}

function setSelectValue(select, value) {
  if ([...select.options].some(option => option.value === String(value))) {
    select.value = String(value)
  }
}

function restoreState() {
  const state = readSearchState(window.location.search)
  elements.search.value = state.query
  setSelectValue(elements.vendor, state.vendor)
  setSelectValue(elements.deviceType, state.deviceType)
  setSelectValue(elements.memoryKind, state.memoryKind)
  setSelectValue(elements.minMemory, state.minMemory)
  setSelectValue(elements.status, state.status)
  setSelectValue(elements.sort, state.sort)
}

function bindEvents() {
  elements.form.addEventListener('input', () => {
    visibleCount = PAGE_SIZE
    render()
  })

  elements.form.addEventListener('reset', () => {
    window.setTimeout(() => {
      visibleCount = PAGE_SIZE
      render()
      elements.search.focus()
    })
  })

  elements.showMore.addEventListener('click', () => {
    visibleCount += PAGE_SIZE
    render()
  })

  document.addEventListener('keydown', event => {
    const target = event.target
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      elements.search.focus()
    }
  })
}

async function loadCatalog() {
  try {
    const response = await fetch('./catalog.json')
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`)

    catalog = await response.json()
    sources = new Map((catalog.sources ?? []).map(source => [source.id, source]))
    populateVendors(catalog.gpus)
    restoreState()
    bindEvents()

    elements.gpuCount.textContent = catalog.gpus.length.toLocaleString()
    elements.loading.hidden = true
    render()
  } catch (error) {
    console.error(error)
    elements.loading.hidden = true
    elements.error.hidden = false
    elements.resultStatus.textContent = 'Catalog unavailable'
  }
}

loadCatalog()
