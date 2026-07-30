import assert from 'node:assert/strict'
import test from 'node:test'

async function loadProjection() {
  try {
    const module = await import('../src/runtime.mjs')
    return module.buildRuntimeArtifact
  } catch {
    return undefined
  }
}

test('runtime artifact includes usable discrete and unified GPUs only', async () => {
  const buildRuntimeArtifact = await loadProjection()
  assert.equal(
    typeof buildRuntimeArtifact,
    'function',
    'buildRuntimeArtifact must be implemented',
  )

  const artifact = buildRuntimeArtifact({
    schema_version: '1.0.0',
    catalog_version: '1.0.0',
    integrated_gpu_patterns: ['Intel Iris'],
    gpus: [
      {
        id: 'apple-m5',
        name: 'Apple M5',
        vendor: 'apple',
        aliases: ['Apple M5 GPU'],
        memory: {
          capacity_gb: 32,
          bandwidth_gbps: 153,
          unified: true,
        },
        interconnects: [],
      },
      {
        id: 'nvidia-b200',
        name: 'B200',
        vendor: 'nvidia',
        aliases: [],
        memory: {
          capacity_gb: 180,
          bandwidth_gbps: 8000,
          unified: false,
        },
        interconnects: ['nvlink'],
      },
      {
        id: 'intel-unknown',
        name: 'Unknown Intel GPU',
        vendor: 'intel',
        aliases: [],
        memory: {
          capacity_gb: null,
          bandwidth_gbps: null,
          unified: false,
        },
        interconnects: [],
      },
      {
        id: 'legacy-usable',
        name: 'Legacy Usable GPU',
        vendor: 'legacy',
        aliases: [],
        memory: {
          capacity_gb: 8,
          bandwidth_gbps: 100,
          unified: false,
        },
        interconnects: [],
      },
    ],
  })

  assert.deepEqual(artifact, {
    schema_version: '1.0.0',
    catalog_version: '1.0.0',
    source_repository: 'https://github.com/onepunk/open-gpu-catalog',
    gpus: [
      {
        name: 'B200',
        aliases: [],
        vendor: 'nvidia',
        vram_gb: 180,
        bandwidth_gbps: 8000,
        nvlink: true,
      },
      {
        name: 'Apple M5',
        aliases: ['Apple M5 GPU'],
        vendor: 'apple',
        vram_gb: null,
        bandwidth_gbps: 153,
        unified: true,
      },
    ],
    integrated_gpu_patterns: ['Intel Iris'],
  })
})
