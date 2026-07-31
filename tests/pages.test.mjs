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
  assert.match(html, /href="https:\/\/github\.com\/onepunk\/open-gpu-db"/)
  assert.match(html, /href="https:\/\/github\.com\/onepunk\/open-gpu-db\/issues\/new"/)
  assert.match(html, /Submit a GPU \/ update/)
  assert.match(html, /Searchable GPU database/)
  assert.match(html, /Search the GPU database\./)
  assert.match(html, /Search the database for graphics processors, accelerators, and/)
  assert.match(html, /id="gpu-count"/)
  assert.doesNotMatch(html, /id="source-count"|id="catalog-version"/)
  assert.doesNotMatch(html, /Find the GPU behind the numbers|Open data · Vendor-verified/)
  assert.doesNotMatch(html, /Source-backed fields|Data should be uncertain/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /:focus-visible/)
  assert.match(app, /import \{ searchCatalog \} from '\.\/search\.mjs'/)
  assert.match(app, /import \{ buildSourceLinks \} from '\.\/source-links\.mjs'/)
})

test('the explorer ships the themed workstation shell', async () => {
  const [html, app, themes] = await Promise.all([
    read('../site/index.html'),
    read('../site/app.mjs'),
    read('../site/themes.mjs'),
  ])

  assert.match(html, /<dialog id="theme-picker"/)
  assert.match(html, /id="record"/)
  assert.match(app, /from '\.\/themes\.mjs'/)
  assert.match(themes, /export const THEMES = \[/)
  // Dark and light appearances must both be represented.
  assert.match(themes, /appearance: 'dark'/)
  assert.match(themes, /appearance: 'light'/)
})

test('public copy uses neutral community-reference labels', async () => {
  const copy = await Promise.all([
    read('../README.md'),
    read('../NOTICE'),
    read('../CHANGELOG.md'),
    read('../data/sources.json'),
    read('../site/index.html'),
    read('../site/source-links.mjs'),
  ])

  assert.match(copy.join('\n'), /Community specification/)
})

test('the repository defines a dependency-free static build and deploy setup', async () => {
  const [packageJson, buildScript, wranglerConfig] = await Promise.all([
    read('../package.json'),
    read('../scripts/build-pages.mjs'),
    read('../wrangler.jsonc'),
  ])

  assert.match(packageJson, /"build:pages": "node scripts\/build-pages\.mjs"/)
  assert.match(packageJson, /"deploy": "wrangler deploy"/)
  assert.match(buildScript, /copyFile\(catalogPath, join\(outputPath, 'catalog\.json'\)\)/)
  assert.match(wranglerConfig, /"pattern": "opengpudb\.com", "custom_domain": true/)
  assert.match(wranglerConfig, /"directory": "\.\/\.pages"/)
})
