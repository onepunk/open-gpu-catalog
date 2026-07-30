import { searchCatalog } from './search.mjs'
import { buildSearchParams, readSearchState } from './search.mjs'
import { buildSourceLinks } from './source-links.mjs'
import { THEMES, applyTheme, defaultThemeId, storedThemeId } from './themes.mjs'

const PAGE_SIZE = 100
const VENDOR_COLORS = {
  nvidia: 'var(--vendor-nvidia)',
  amd: 'var(--vendor-amd)',
  intel: 'var(--vendor-intel)',
  apple: 'var(--vendor-apple)',
  matrox: 'var(--vendor-matrox)',
  '3dfx': 'var(--vendor-3dfx)',
  sony: 'var(--vendor-sony)',
  xgi: 'var(--vendor-xgi)',
}
const VENDOR_LABELS = { amd: 'AMD', nvidia: 'NVIDIA', xgi: 'XGI', '3dfx': '3dfx' }

const elements = {
  search: document.querySelector('#catalog-search'),
  vendorFacets: document.querySelector('#vendor-facets'),
  typeFacets: document.querySelector('#type-facets'),
  memoryFacets: document.querySelector('#memory-facets'),
  minMemory: document.querySelector('#capacity-filter'),
  status: document.querySelector('#status-filter'),
  sort: document.querySelector('#sort-filter'),
  clearFilters: document.querySelector('#clear-filters'),
  facetToggle: document.querySelector('#facet-toggle'),
  resultStatus: document.querySelector('#result-status'),
  loading: document.querySelector('#loading-state'),
  error: document.querySelector('#error-state'),
  empty: document.querySelector('#empty-state'),
  results: document.querySelector('#results'),
  rows: document.querySelector('#result-rows'),
  showMore: document.querySelector('#show-more'),
  record: document.querySelector('#record'),
  gpuCount: document.querySelector('#gpu-count'),
  themeButton: document.querySelector('#theme-button'),
  themePicker: document.querySelector('#theme-picker'),
  themeList: document.querySelector('#theme-list'),
}

let catalog = null
let sources = new Map()
let byId = new Map()
let visibleCount = PAGE_SIZE
let selectedId = null
let currentMatches = []

const state = {
  query: '',
  vendor: 'all',
  deviceType: 'all',
  memoryKind: 'all',
  minMemory: 0,
  status: 'all',
  sort: 'newest',
}

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName)
  if (options.className) element.className = options.className
  if (options.text !== undefined) element.textContent = options.text
  if (options.title) element.title = options.title
  return element
}

function vendorColor(vendor) {
  return VENDOR_COLORS[vendor] ?? 'var(--faint)'
}

function formatName(value) {
  if (!value) return 'Unknown'
  if (value === 'soc') return 'System on chip'
  const label = VENDOR_LABELS[value]
  if (label) return label
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function formatCapacity(gpu) {
  const capacity = gpu.memory.capacity_gb
  if (capacity === null || capacity === undefined) return '—'
  const formatted = new Intl.NumberFormat('en', {
    maximumFractionDigits: capacity < 1 ? 3 : 1,
  }).format(capacity)
  return `${formatted} GB`
}

function formatBandwidth(value) {
  if (value === null || value === undefined) return '—'
  if (value >= 1000) {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value / 1000)} TB/s`
  }
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)} GB/s`
}

function formatDate(value) {
  if (!value) return 'unknown date'
  const [year, month] = value.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return month ? `${months[Number(month) - 1]} ${year}` : year
}

/* Percentile ranks across the catalog, used by the record context bars. */
function computePercentiles(gpus) {
  const rank = values => {
    const sorted = values.filter(value => value !== null && value !== undefined).sort((a, b) => a - b)
    return value => {
      if (value === null || value === undefined || !sorted.length) return null
      let low = 0
      let high = sorted.length
      while (low < high) {
        const mid = (low + high) >> 1
        if (sorted[mid] <= value) low = mid + 1
        else high = mid
      }
      return Math.round((100 * low) / sorted.length)
    }
  }
  const bandwidthRank = rank(gpus.map(gpu => gpu.memory.bandwidth_gbps))
  const capacityRank = rank(gpus.map(gpu => gpu.memory.capacity_gb))
  for (const gpu of gpus) {
    gpu.bandwidthPercentile = bandwidthRank(gpu.memory.bandwidth_gbps)
    gpu.capacityPercentile = capacityRank(gpu.memory.capacity_gb)
  }
}

function familySiblings(gpu, limit = 8) {
  if (!gpu.generation) return []
  return catalog.gpus
    .filter(candidate =>
      candidate.vendor === gpu.vendor &&
      candidate.generation === gpu.generation &&
      candidate.id !== gpu.id,
    )
    .sort((left, right) => (right.memory.capacity_gb ?? 0) - (left.memory.capacity_gb ?? 0))
    .slice(0, limit)
}

/* ---- Facets ---- */

function buildFacetButtons(container, entries, key, { colored = false } = {}) {
  container.replaceChildren(...entries.map(([value, count]) => {
    const button = createElement('button', { className: 'facet' })
    button.type = 'button'
    button.dataset.value = value
    button.setAttribute('aria-pressed', 'false')
    if (colored) {
      const swatch = createElement('span', { className: 'swatch' })
      swatch.style.background = vendorColor(value)
      button.append(swatch)
    }
    button.append(createElement('span', { text: formatName(value) }))
    button.append(createElement('span', { className: 'facet-count', text: count.toLocaleString() }))
    button.addEventListener('click', () => {
      state[key] = state[key] === value ? 'all' : value
      visibleCount = PAGE_SIZE
      render()
    })
    return button
  }))
}

function buildFacets() {
  const vendorCounts = new Map()
  const typeCounts = new Map()
  let unifiedCount = 0
  for (const gpu of catalog.gpus) {
    vendorCounts.set(gpu.vendor, (vendorCounts.get(gpu.vendor) ?? 0) + 1)
    typeCounts.set(gpu.device_type, (typeCounts.get(gpu.device_type) ?? 0) + 1)
    if (gpu.memory.unified) unifiedCount += 1
  }
  const sorted = counts => [...counts].sort((left, right) => right[1] - left[1])
  buildFacetButtons(elements.vendorFacets, sorted(vendorCounts), 'vendor', { colored: true })
  buildFacetButtons(elements.typeFacets, sorted(typeCounts), 'deviceType')
  buildFacetButtons(elements.memoryFacets, [
    ['dedicated', catalog.gpus.length - unifiedCount],
    ['unified', unifiedCount],
  ], 'memoryKind')
}

function syncFacetState() {
  const groups = [
    [elements.vendorFacets, 'vendor'],
    [elements.typeFacets, 'deviceType'],
    [elements.memoryFacets, 'memoryKind'],
  ]
  for (const [container, key] of groups) {
    for (const button of container.querySelectorAll('.facet')) {
      button.setAttribute('aria-pressed', String(state[key] === button.dataset.value))
    }
  }
  elements.minMemory.value = String(state.minMemory)
  elements.status.value = state.status
  elements.sort.value = state.sort
}

/* ---- URL state ---- */

function selectionHash() {
  return selectedId ? `#gpu/${selectedId}` : ''
}

function updateUrl() {
  const params = buildSearchParams(state).toString()
  const url = params ? `${window.location.pathname}?${params}` : window.location.pathname
  window.history.replaceState(null, '', `${url}${selectionHash()}`)
}

function readSelectionFromHash() {
  const match = window.location.hash.match(/^#gpu\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

/* ---- Result list ---- */

function createRow(gpu) {
  const row = createElement('button', { className: 'row' })
  row.type = 'button'
  row.dataset.id = gpu.id
  row.style.setProperty('--vendor', vendorColor(gpu.vendor))
  row.setAttribute('aria-current', String(gpu.id === selectedId))

  const identity = createElement('span')
  identity.append(
    createElement('span', { className: 'row-name', text: gpu.name }),
    createElement('span', {
      className: 'row-family',
      text: `${formatName(gpu.vendor)} · ${gpu.generation ?? gpu.architecture ?? '—'}`,
    }),
  )
  row.append(
    identity,
    createElement('span', { className: 'row-metric', text: formatCapacity(gpu) }),
    createElement('span', { className: 'row-metric', text: formatBandwidth(gpu.memory.bandwidth_gbps) }),
  )
  row.addEventListener('click', () => selectGpu(gpu.id))
  return row
}

const sentinel = createElement('div', { className: 'list-sentinel' })
const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && visibleCount < currentMatches.length) {
        visibleCount += PAGE_SIZE
        renderRows()
      }
    }, { root: null, rootMargin: '600px' })
  : null

function renderRows() {
  const visible = currentMatches.slice(0, visibleCount)
  const fragment = document.createDocumentFragment()
  for (const gpu of visible) fragment.append(createRow(gpu))
  observer?.disconnect()
  elements.rows.replaceChildren(fragment)
  const hasMore = currentMatches.length > visibleCount
  if (observer && hasMore) {
    elements.rows.append(sentinel)
    observer.observe(sentinel)
  }
  // Fallback control when IntersectionObserver is unavailable.
  elements.showMore.hidden = Boolean(observer) || !hasMore
}

function render() {
  if (!catalog) return

  syncFacetState()
  currentMatches = searchCatalog(catalog.gpus, state)
  const total = catalog.gpus.length

  elements.empty.hidden = currentMatches.length !== 0
  elements.results.hidden = currentMatches.length === 0
  elements.resultStatus.textContent = currentMatches.length === total
    ? `${total.toLocaleString()} GPUs`
    : `${currentMatches.length.toLocaleString()} of ${total.toLocaleString()} GPUs`

  renderRows()
  renderRecord()
  updateUrl()
}

/* ---- Record panel ---- */

function specEntry(term, value, { soft = false, note = '' } = {}) {
  const wrap = createElement('div', { className: 'spec' })
  const dd = createElement('dd', { text: value })
  if (soft) dd.className = 'spec-soft'
  wrap.append(createElement('dt', { text: term }), dd)
  if (note) dd.append(createElement('small', { text: note }))
  return wrap
}

function contextBar(label, percentile, color) {
  const row = createElement('div')
  const caption = createElement('div', { className: 'bar-label' })
  caption.append(
    createElement('span', { text: label }),
    createElement('span', { text: percentile === null ? 'no data' : `P${percentile} of catalog` }),
  )
  const track = createElement('div', { className: 'bar-track' })
  const fill = createElement('div', { className: 'bar-fill' })
  fill.style.width = `${percentile ?? 0}%`
  fill.style.setProperty('--vendor', color)
  track.append(fill)
  row.append(caption, track)
  return row
}

function renderRecord() {
  const gpu = byId.get(selectedId)
  if (!gpu) {
    const empty = createElement('p', {
      className: 'record-empty',
      text: 'Select a GPU to inspect its record',
    })
    elements.record.replaceChildren(empty)
    return
  }

  const color = vendorColor(gpu.vendor)
  const inner = createElement('div', { className: 'record-inner' })

  const close = createElement('button', { className: 'record-close', text: '✕' })
  close.type = 'button'
  close.setAttribute('aria-label', 'Close record panel')
  close.addEventListener('click', () => document.body.classList.remove('record-open'))

  const spine = createElement('div', { className: 'spine' })
  spine.style.background = color

  const crumb = createElement('p', { className: 'crumb' })
  crumb.append(
    document.createTextNode(`${formatName(gpu.vendor)} `),
    createElement('b', { text: '›' }),
    document.createTextNode(` ${gpu.generation ?? '—'}`),
  )

  const name = createElement('h1', { className: 'record-name', text: gpu.name })

  const sub = createElement('p', { className: 'record-sub' })
  const subParts = [
    gpu.architecture ?? '—',
    formatName(gpu.device_type),
    `released ${formatDate(gpu.release_date)}`,
  ]
  if (gpu.status && gpu.status !== 'unknown') subParts.push(formatName(gpu.status))
  subParts.forEach((part, index) => {
    if (index) sub.append(createElement('span', { className: 'sep', text: '·' }))
    sub.append(document.createTextNode(part))
  })

  const specs = createElement('dl', { className: 'spec-grid' })
  specs.append(
    specEntry('Memory', formatCapacity(gpu), {
      note: gpu.memory.unified ? 'unified maximum' : 'dedicated',
    }),
    specEntry('Memory type', gpu.memory.type ?? '—'),
    specEntry('Bandwidth', formatBandwidth(gpu.memory.bandwidth_gbps), {
      note: gpu.memory.bandwidth_gbps === null || gpu.memory.bandwidth_gbps === undefined
        ? ''
        : `${gpu.memory.bandwidth_gbps} GB/s published`,
    }),
    specEntry('Architecture', gpu.architecture ?? '—', { soft: true }),
  )

  const bars = createElement('div', { className: 'bars' })
  bars.append(
    contextBar('Bandwidth rank', gpu.bandwidthPercentile, color),
    contextBar('Capacity rank', gpu.capacityPercentile, color),
  )

  inner.append(close, spine, crumb, name, sub, specs, bars)

  const siblings = familySiblings(gpu)
  if (siblings.length) {
    inner.append(createElement('h2', { className: 'record-section', text: `Same family — ${gpu.generation}` }))
    const list = createElement('div', { className: 'siblings' })
    for (const sibling of siblings) {
      const chip = createElement('button', { className: 'sibling', text: sibling.name })
      chip.type = 'button'
      chip.append(createElement('b', { text: formatCapacity(sibling) }))
      chip.addEventListener('click', () => selectGpu(sibling.id))
      list.append(chip)
    }
    inner.append(list)
  }

  inner.append(createElement('h2', { className: 'record-section', text: 'Sources' }))
  const links = buildSourceLinks(gpu, sources)
  if (!links.length) {
    inner.append(createElement('p', { className: 'source-row', text: 'No linked source' }))
  }
  for (const sourceLink of links) {
    const rowEl = createElement('div', { className: 'source-row' })
    const anchor = createElement('a', { text: sourceLink.label, title: sourceLink.url })
    anchor.href = sourceLink.url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    rowEl.append(anchor)
    if (sourceLink.primary) {
      rowEl.append(createElement('span', { className: 'source-primary-tag', text: 'PRIMARY' }))
    }
    inner.append(rowEl)
  }

  const recordId = createElement('p', { className: 'record-id' })
  recordId.append(document.createTextNode('record '), createElement('code', { text: gpu.id }))
  if (catalog.version) recordId.append(document.createTextNode(` · catalog ${catalog.version}`))
  inner.append(recordId)

  elements.record.replaceChildren(inner)
}

function selectGpu(id) {
  selectedId = id
  document.body.classList.add('record-open')
  for (const row of elements.rows.querySelectorAll('.row')) {
    row.setAttribute('aria-current', String(row.dataset.id === selectedId))
  }
  renderRecord()
  updateUrl()
  elements.record.scrollTop = 0
}

/* ---- Theme picker ---- */

let activeThemeId = storedThemeId() ?? defaultThemeId()
let highlightedThemeIndex = 0

function buildThemePicker() {
  const fragment = document.createDocumentFragment()
  let lastAppearance = null
  THEMES.forEach((theme, index) => {
    if (theme.appearance !== lastAppearance) {
      lastAppearance = theme.appearance
      fragment.append(createElement('div', {
        className: 'picker-group',
        text: theme.appearance === 'dark' ? 'Dark' : 'Light',
      }))
    }
    const option = createElement('button', { className: 'theme-option' })
    option.type = 'button'
    option.id = `theme-option-${theme.id}`
    option.setAttribute('role', 'option')
    option.dataset.index = String(index)
    const dots = createElement('span', { className: 'theme-dots' })
    for (const key of ['bg', 'accent', 'ink']) {
      const dot = createElement('i')
      dot.style.background = theme.vars[key]
      dots.append(dot)
    }
    option.append(dots, createElement('span', { text: theme.name }))
    option.append(createElement('span', { className: 'theme-check', text: '✓' }))
    option.addEventListener('click', () => {
      highlightedThemeIndex = index
      commitTheme()
    })
    option.addEventListener('mousemove', () => highlightTheme(index, { preview: false }))
    fragment.append(option)
  })
  elements.themeList.replaceChildren(fragment)
}

function highlightTheme(index, { preview = true } = {}) {
  highlightedThemeIndex = (index + THEMES.length) % THEMES.length
  const theme = THEMES[highlightedThemeIndex]
  for (const option of elements.themeList.querySelectorAll('.theme-option')) {
    const isHighlighted = Number(option.dataset.index) === highlightedThemeIndex
    option.classList.toggle('highlighted', isHighlighted)
    option.setAttribute('aria-selected', String(option.id === `theme-option-${activeThemeId}`))
    if (isHighlighted) option.scrollIntoView({ block: 'nearest' })
  }
  elements.themeList.setAttribute('aria-activedescendant', `theme-option-${theme.id}`)
  if (preview) applyTheme(theme.id)
}

function commitTheme() {
  activeThemeId = THEMES[highlightedThemeIndex].id
  applyTheme(activeThemeId, { persist: true })
  elements.themePicker.close()
}

function openThemePicker() {
  const index = THEMES.findIndex(theme => theme.id === activeThemeId)
  elements.themePicker.showModal()
  highlightTheme(index === -1 ? 0 : index, { preview: false })
  elements.themeList.focus()
}

function bindThemePicker() {
  buildThemePicker()
  applyTheme(activeThemeId)

  elements.themeButton.addEventListener('click', openThemePicker)

  elements.themePicker.addEventListener('cancel', () => {
    // Esc reverts any previewed theme back to the applied one.
    applyTheme(activeThemeId)
  })
  elements.themePicker.addEventListener('click', event => {
    if (event.target === elements.themePicker) {
      applyTheme(activeThemeId)
      elements.themePicker.close()
    }
  })
  elements.themeList.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      highlightTheme(highlightedThemeIndex + (event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commitTheme()
    }
  })
}

/* ---- Events ---- */

function bindEvents() {
  elements.search.addEventListener('input', () => {
    state.query = elements.search.value
    visibleCount = PAGE_SIZE
    render()
  })
  elements.minMemory.addEventListener('change', () => {
    state.minMemory = Number(elements.minMemory.value)
    visibleCount = PAGE_SIZE
    render()
  })
  elements.status.addEventListener('change', () => {
    state.status = elements.status.value
    visibleCount = PAGE_SIZE
    render()
  })
  elements.sort.addEventListener('change', () => {
    state.sort = elements.sort.value
    visibleCount = PAGE_SIZE
    render()
  })
  elements.clearFilters.addEventListener('click', () => {
    Object.assign(state, {
      query: '',
      vendor: 'all',
      deviceType: 'all',
      memoryKind: 'all',
      minMemory: 0,
      status: 'all',
      sort: 'newest',
    })
    elements.search.value = ''
    visibleCount = PAGE_SIZE
    render()
    elements.search.focus()
  })
  elements.showMore.addEventListener('click', () => {
    visibleCount += PAGE_SIZE
    renderRows()
  })
  elements.facetToggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('facets-open')
    elements.facetToggle.setAttribute('aria-expanded', String(open))
  })

  document.addEventListener('keydown', event => {
    const target = event.target
    const isTyping = target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping) return
    if (elements.themePicker.open) return

    if (event.key === '/') {
      event.preventDefault()
      elements.search.focus()
    } else if (event.key === 't') {
      event.preventDefault()
      openThemePicker()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!currentMatches.length) return
      event.preventDefault()
      const index = currentMatches.findIndex(gpu => gpu.id === selectedId)
      const next = index === -1
        ? 0
        : Math.min(Math.max(index + (event.key === 'ArrowDown' ? 1 : -1), 0), currentMatches.length - 1)
      if (next >= visibleCount) {
        visibleCount += PAGE_SIZE
        renderRows()
      }
      selectGpu(currentMatches[next].id)
      elements.rows.querySelector(`[data-id="${CSS.escape(currentMatches[next].id)}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Escape') {
      document.body.classList.remove('record-open')
    }
  })
}

function restoreState() {
  const params = new URLSearchParams(window.location.search)
  const restored = readSearchState(window.location.search)
  Object.assign(state, restored)
  // Newest-first is the interface default; A–Z stays available in the menu.
  if (!params.has('sort')) state.sort = 'newest'
  elements.search.value = state.query
  selectedId = readSelectionFromHash()
}

/* ---- Boot ---- */

async function loadCatalog() {
  try {
    const response = await fetch('./catalog.json')
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`)

    catalog = await response.json()
    sources = new Map((catalog.sources ?? []).map(source => [source.id, source]))
    byId = new Map(catalog.gpus.map(gpu => [gpu.id, gpu]))
    computePercentiles(catalog.gpus)
    buildFacets()
    restoreState()
    bindEvents()

    elements.gpuCount.textContent = catalog.gpus.length.toLocaleString()
    elements.loading.hidden = true

    if (selectedId && !byId.has(selectedId)) selectedId = null
    currentMatches = searchCatalog(catalog.gpus, state)
    if (!selectedId) selectedId = currentMatches[0]?.id ?? null
    if (window.matchMedia('(min-width: 1101px)').matches) {
      document.body.classList.add('record-open')
    } else if (readSelectionFromHash()) {
      // A shared deep link should open the record even on small screens.
      document.body.classList.add('record-open')
    }
    render()
  } catch (error) {
    console.error(error)
    elements.loading.hidden = true
    elements.error.hidden = false
    elements.resultStatus.textContent = 'Catalog unavailable'
  }
}

bindThemePicker()
loadCatalog()
