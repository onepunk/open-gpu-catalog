import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readJson(path) {
  try {
    return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
  } catch {
    return null
  }
}

test('published catalog contains the verified current GPU layer', async () => {
  const catalog = await readJson('../dist/catalog.json')
  assert.ok(catalog, 'dist/catalog.json must be built')
  assert.ok(catalog.gpus.length >= 2_923)

  const byId = Object.fromEntries(catalog.gpus.map(gpu => [gpu.id, gpu]))
  assert.equal(byId['apple-m4-ultra'], undefined)
  assert.deepEqual(
    [
      byId['apple-m5'].memory.bandwidth_gbps,
      byId['apple-m5-pro'].memory.bandwidth_gbps,
      byId['apple-m5-max'].memory.bandwidth_gbps,
    ],
    [153, 307, 614],
  )
  assert.deepEqual(
    [
      byId['nvidia-b200'].memory.capacity_gb,
      byId['nvidia-b200'].memory.bandwidth_gbps,
      byId['nvidia-b300'].memory.capacity_gb,
      byId['nvidia-b300'].memory.bandwidth_gbps,
    ],
    [180, 8000, 288, 8000],
  )
  assert.deepEqual(
    [
      byId['amd-instinct-mi455x'].memory.capacity_gb,
      byId['amd-instinct-mi455x'].memory.bandwidth_gbps,
      byId['nvidia-vera-rubin'].memory.capacity_gb,
      byId['nvidia-vera-rubin'].memory.bandwidth_gbps,
    ],
    [432, 23300, 288, 22000],
  )
  assert.deepEqual(
    [
      byId['intel-arc-pro-b70'].memory.capacity_gb,
      byId['intel-arc-pro-b70'].memory.bandwidth_gbps,
      byId['intel-arc-pro-b65'].memory.capacity_gb,
      byId['intel-arc-pro-b65'].memory.bandwidth_gbps,
    ],
    [32, 608, 32, 608],
  )
  assert.ok(catalog.gpus.every(gpu => gpu.provenance.length > 0))
})

test('published catalog contains current and historical additions with exact provenance', async () => {
  const catalog = await readJson('../dist/catalog.json')
  assert.ok(catalog, 'dist/catalog.json must be built')
  const byId = Object.fromEntries(catalog.gpus.map(gpu => [gpu.id, gpu]))

  assert.deepEqual(
    [
      byId['amd-radeon-rx-9050-4-gb'].release_date,
      byId['amd-radeon-rx-9050-4-gb'].memory.bandwidth_gbps,
      byId['amd-radeon-instinct-mi350p'].memory.capacity_gb,
      byId['nvidia-rtx-pro-4500-blackwell-server'].memory.bandwidth_gbps,
    ],
    ['2026-07-28', 144, 144, 800],
  )
  assert.deepEqual(
    [
      byId['amd-radeon-r9-290x'].memory.bandwidth_gbps,
      byId['microsoft-xbox-one-gpu'].memory.unified,
      byId['nvidia-quadro-fx-5800'].memory.capacity_gb,
      byId['sis-315'].release_date,
    ],
    [320, true, 4, '2000-12-11'],
  )

  const directSource = byId['amd-radeon-rx-9050-4-gb'].provenance.find(
    item => item.source_record_id === 'c4404',
  )
  assert.equal(
    directSource.source_url,
    'https://www.techpowerup.com/gpu-specs/radeon-rx-9050-4-gb.c4404',
  )
})

test('published runtime artifact is a usable projection of the catalog', async () => {
  const artifact = await readJson('../dist/runtime.json')
  assert.ok(artifact, 'dist/runtime.json must be built')
  assert.ok(artifact.gpus.length >= 1_500)
  assert.ok(artifact.gpus.some(gpu => gpu.name === 'Apple M5 Max' && gpu.unified))
  assert.ok(artifact.gpus.some(gpu => gpu.name === 'AMD Instinct MI455X'))
  assert.ok(artifact.gpus.some(gpu => gpu.name === 'NVIDIA Vera Rubin GPU'))
  assert.ok(artifact.gpus.some(gpu => gpu.name === 'Radeon RX 9050 8 GB'))
  assert.ok(artifact.gpus.some(gpu => gpu.name === 'AMD Instinct MI350P'))
  assert.ok(artifact.integrated_gpu_patterns.includes('Intel Iris'))
})
