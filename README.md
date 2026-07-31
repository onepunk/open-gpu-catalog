# Open GPU DB

A public GPU database with stable identifiers, field-level source provenance,
first-party corrections, detection aliases, and versioned JSON files for
applications that need GPU specifications in a stable, machine-readable format.

[Browse and search the database](https://opengpudb.com)
or use the versioned JSON artifacts directly.

## Why this exists

Open GPU DB combines a broad imported dataset with maintained, source-linked
changes through a layered build:

1. A pinned dataset from the MIT-licensed
   [dbgpu](https://github.com/painebenjamin/dbgpu) project supplies broad
   NVIDIA, AMD, and Intel coverage.
2. Maintained overrides correct imported values when first-party manufacturer
   documentation disagrees with the imported data.
3. Missing products are maintained as explicit additions. These include
   first-party-sourced Apple Silicon and current AI accelerators, as well as
   records that retain clear community-source provenance.
4. Detection aliases and derived interconnect rules are separate layers, so
   canonical specifications are not confused with browser or driver strings.
5. The build validates identifiers, provenance, memory values, and name/alias
   uniqueness before generating the JSON files in stable ID order.

The imported dbgpu dataset remains unmodified in
`data/imports/dbgpu/`. Its tool version, checksum, license, and retrieval date
are recorded in `metadata.json`. Each normalized record retains the original
reference ID and URL where available. Maintained additions live in
`data/layers/additions.json`.

## JSON files

- `dist/catalog.json` — the complete normalized database and source registry.
- `dist/runtime.json` — a compact, application-oriented subset of NVIDIA, AMD,
  Intel, and Apple records with positive memory bandwidth and either unified
  memory or at least 1 GB of dedicated VRAM. It includes dedicated VRAM
  capacity where applicable, unified-memory and NVLink flags, aliases, and
  integrated-GPU detection patterns.
- `schema/catalog.schema.json` — the versioned public schema.

Raw GitHub URL:

```text
https://raw.githubusercontent.com/onepunk/open-gpu-db/main/dist/catalog.json
```

Runtime-oriented consumer URL:

```text
https://raw.githubusercontent.com/onepunk/open-gpu-db/main/dist/runtime.json
```

## Data model

Canonical GPU records contain:

- stable `id`, canonical `name`, `vendor`, and `device_type`;
- architecture, generation, release date, and lifecycle status when known;
- memory capacity, type, bandwidth, and unified-memory semantics;
- optional silicon, clock, compute, power, interface, and graphics API details;
- aliases used by browsers, drivers, and product marketing;
- interconnect capabilities;
- field-level provenance referencing the embedded source registry.

For configurable Apple chips, the canonical record describes the highest
published memory capacity and bandwidth configuration. Consumer artifacts mark
that memory as unified rather than dedicated VRAM.

## Build and validation

Requires Node.js 20 or newer and has no runtime dependencies.

```bash
npm test
npm run build
npm run check
npm run build:pages
npm run audit:sources
```

`npm run build` regenerates both committed JSON files from the checked-in import
and maintenance layers. Given the same inputs and build code, it emits the same
byte-for-byte output; `npm run check` verifies that the committed files match.
`npm run build:pages` copies the dependency-free search interface and complete
database into `.pages/`. The GitHub Actions workflow runs the tests, artifact
check, and page build for pull requests and pushes to `main`. To publish the
site to [opengpudb.com](https://opengpudb.com) manually, run
`npm run build:pages && npm run deploy`.
The source audit reports which records have first-party vendor documentation,
which currently rely on a TechPowerUp specification reference, and which need
source enrichment. Use `npm run audit:sources -- --json` for record IDs.

## Contributing data

Prefer primary manufacturer documentation. A correction or addition should:

1. add or update a source in `data/sources.json`;
2. modify the appropriate file under `data/layers/`;
3. identify exactly which fields the source supports;
4. regenerate artifacts and include a regression test for disputed or
   high-impact specifications.

Community databases are useful discovery inputs, but vendor specifications take
precedence. Uncertain values should remain unknown rather than being guessed.

## Attribution and license

Open GPU DB is licensed under Apache-2.0. It incorporates an attributed,
pinned dataset from the MIT-licensed dbgpu project. See [NOTICE](NOTICE),
[LICENSE](LICENSE), and `data/imports/dbgpu/metadata.json`.
