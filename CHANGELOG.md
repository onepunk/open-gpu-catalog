# Changelog

## Unreleased

- Add 77 GPU records, including 25 dated 2026 releases and 52 historical
  additions.
- Correct the AMD Instinct MI455X and Intel Arc Pro B65/B70 release metadata
  from current first-party documentation.
- Add links for submitting a GPU or catalog update through GitHub Issues.
- Identify specification references by their website name in the source list.

## 1.3.0 — 2026-07-30

- Re-source the imported dataset directly to the MIT-licensed dbgpu project,
  removing the intermediary snapshot; identifiers and values are unchanged.
- Enrich catalog records with extended specifications: silicon (chip, process,
  transistors, die size, foundry), clocks, compute units, throughput, TDP,
  bus interface, and graphics API support.
- Show the extended specifications on each record in the site explorer.

## 1.2.0 — 2026-07-30

- Rename the project and repository to Open GPU DB.
- Display direct source destinations instead of import-layer names.
- Prioritize first-party vendor documentation ahead of third-party references.
- Add a deterministic source-link coverage audit for future enrichment.
- Simplify the public search page copy and summary.

## 1.1.0 — 2026-07-30

- Rename the compact consumer artifact to the agnostic `dist/runtime.json`.
- Add a searchable, responsive GitHub Pages catalog explorer.
- Add URL-persisted filters, sortable results, and provenance details.

## 1.0.0 — 2026-07-30

- Import and attribute 2,824 DBGPU records.
- Add a normalized schema with stable identifiers and field-level provenance.
- Add vendor-verified B200 and B300 corrections.
- Add Apple M1 through M5-family unified-memory records.
- Add NVIDIA Vera Rubin, AMD Instinct MI455X, and Intel Arc Pro B70/B65.
- Add detection aliases, integrated-GPU patterns, and derived NVLink rules.
- Publish deterministic full-catalog and compact runtime artifacts.
