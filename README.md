# Open GPU DB

A public, reproducible GPU catalog with stable identifiers, source provenance,
vendor-verified corrections, browser-detection aliases, and generated artifacts
for applications that need reliable GPU memory data.

[Browse and search the database](https://opengpudb.com)
or use the versioned JSON artifacts directly.

## Why this exists

No single public GPU database is both broad and authoritative. Open GPU DB
uses a layered model:

1. A pinned snapshot of the Apache-2.0
   [RightNow GPU Database](https://github.com/RightNow-AI/RightNow-GPU-Database)
   supplies broad NVIDIA, AMD, and Intel coverage.
2. Official manufacturer documentation overrides imported values when the
   sources disagree.
3. Missing products, including Apple Silicon and current AI accelerators, are
   maintained as explicit additions.
4. Detection aliases and derived interconnect rules are separate layers, so
   canonical specifications are not confused with browser or driver strings.
5. The build validates identifiers, provenance, memory values, and name/alias
   uniqueness before publishing deterministic artifacts.

The imported RightNow snapshot remains unmodified in
`data/imports/rightnow/`. Its commit, checksum, license, and retrieval date are
recorded in `metadata.json`. Each normalized record retains the original record
ID and TechPowerUp URL where available.

## Artifacts

- `dist/catalog.json` — the complete normalized catalog and source registry.
- `dist/runtime.json` — a compact projection containing GPUs with usable
  capacity and bandwidth data, unified-memory semantics, NVLink flags, aliases,
  and integrated-GPU detection patterns.
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

`npm run build` regenerates both committed artifacts. `npm run check` fails when
the committed artifacts differ from their deterministic build. `npm run build:pages`
copies the dependency-free search interface and complete catalog into `.pages/`.
Pushing to `main` deploys the site to [opengpudb.com](https://opengpudb.com)
automatically: the Cloudflare Workers build runs the tests, the artifact check,
and the page build before publishing. `npm run deploy` performs the same
publish manually.
The source audit reports which records have first-party vendor documentation,
which currently rely on a specific third-party specification page, and which
need source enrichment. Use `npm run audit:sources -- --json` for record IDs.

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
pinned snapshot of the Apache-2.0 RightNow GPU Database. See [NOTICE](NOTICE),
[LICENSE](LICENSE), and `data/imports/rightnow/metadata.json`.
