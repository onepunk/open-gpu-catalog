import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function read(path) {
  try {
    return await readFile(new URL(path, import.meta.url), 'utf8')
  } catch {
    return ''
  }
}

test('catalog page exposes an accessible searchable data explorer shell', async () => {
  const [html, css, app] = await Promise.all([
    read('../site/index.html'),
    read('../site/styles.css'),
    read('../site/app.mjs'),
  ])

  assert.match(html, /<main[^>]+id="main"/)
  assert.match(html, /<label[^>]+for="catalog-search"/)
  assert.match(html, /id="result-status"[^>]+role="status"/)
  assert.match(html, /aria-labelledby="catalog-heading"/)
  assert.match(html, /href="\.\/catalog\.json"[^>]+download/)
  assert.match(html, /href="https:\/\/github\.com\/onepunk\/open-gpu-catalog"/)
  assert.match(html, /Searchable GPU database/)
  assert.match(html, /Search the GPU catalog\./)
  assert.match(html, /Search the database for graphics processors, accelerators, and/)
  assert.doesNotMatch(html, /Find the GPU behind the numbers|Open data · Vendor-verified/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /:focus-visible/)
  assert.match(app, /import \{ searchCatalog \} from '\.\/search\.mjs'/)
  assert.match(app, /import \{ buildSourceLinks \} from '\.\/source-links\.mjs'/)
})

test('the repository defines a dependency-free GitHub Pages build and deploy workflow', async () => {
  const [packageJson, buildScript, workflow] = await Promise.all([
    read('../package.json'),
    read('../scripts/build-pages.mjs'),
    read('../.github/workflows/pages.yml'),
  ])

  assert.match(packageJson, /"build:pages": "node scripts\/build-pages\.mjs"/)
  assert.match(buildScript, /copyFile\(catalogPath, join\(outputPath, 'catalog\.json'\)\)/)
  assert.match(workflow, /actions\/deploy-pages@v5/)
  assert.match(workflow, /npm run build:pages/)
})
