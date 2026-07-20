# Contributing to DeepSeek Dashboard

Thanks for contributing! This is a single-file HTML dashboard — no build system, no bundler, no framework. Open `index.html` in a browser and you're done.

## How to Test

1. Open `index.html` directly in a browser (`file://` protocol works, no server needed)
2. Drop a DeepSeek usage CSV export onto the page
3. Exercise the feature you're changing: switch workspaces, toggle charts, change granularity, test rate limit panel, trigger anomaly detection
4. For JS logic tests: `npm test` (Vitest, 55 tests)

## How the Code is Organized

`index.html` is a single file containing:
- **Lines 11-367:** CSS (inline `<style>`)
- **Lines 569-2423:** JavaScript (inline `<script>`)
- The HTML skeleton sits between the style and script blocks

Everything is in one file by design — it deploys as a single artifact to GitHub Pages with zero build step.

## How to Update CDN Dependencies

Dependencies are loaded from CDN in `<head>` and at the end of `<body>`:

| Library | CDN | Purpose |
|---------|-----|---------|
| Chart.js | jsDelivr | All chart rendering |
| Chart.js Zoom | jsDelivr | Zoom/pan on charts |
| sql.js | jsDelivr | SQL-powered persistence via IndexedDB |
| JSZip | cdnjs | DeepSeek ZIP export extraction |
| FileSaver.js | cdnjs | CSV export download |

To update:
1. Find the latest version on [jsDelivr](https://www.jsdelivr.com/) or [cdnjs](https://cdnjs.com/)
2. Update the `<script src="...">` or `<link href="...">` tag in `index.html`
3. Update the `README.md` tech stack table
4. Open `index.html` and verify all features still work (charts render, ZIP uploads, CSV export)

## How to Add a Chart Type

1. Add the `<canvas>` element in the HTML skeleton section
2. Add a chart card wrapper in the grid layout
3. Write a `render<ChartName>()` function in the JS block following the existing pattern:
   - Create or reuse a Chart.js instance (track in `chartInstances` object)
   - Destroy the previous instance before creating a new one (`chartInstances.xxx?.destroy()`)
   - Add the instance to `allChartInstances` array for global cleanup
   - Register it in the `refreshAll()` function
4. Add the chart name to the PNG export list in the download handler
5. Add the chart card to the KPI card row if it shows aggregate metrics

## Coding Conventions

- **Vanilla JavaScript only** — no frameworks, no TypeScript, no transpilation
- **One file** — keep CSS and JS inline unless there's a compelling reason to split
- **'use strict'** at the top of the `<script>` block (line 570)
- **Escape user data** — always pass user-controlled strings through `escapeHtml()` before injecting into innerHTML
- **LocalStorage for preferences** — theme, granularity, anomaly settings, rate limit tier. Use the pk_ prefix for persistence keys
- **semantic HTML** — prefer `<button>` over `<div onclick>`, `<label>` for form elements
- **CSS custom properties** for theming — vars in `:root` for light, `[data-theme="dark"]` for dark
- **Mobile-first** — responsive breakpoints at 768px, bottom sheet for filters on small screens
- **Tests for calculations** — CSV parsing, anomaly detection, date grouping, pricing. UI rendering tests are manual (browser-based)

## Git Workflow

- Branch from `main`, submit PRs
- Commits use conventional prefixes: `feat:`, `fix:`, `quality:`, `docs:`, `test:`, `chore:`, `perf:`
- The `docs` branch is the GitHub Pages deployment target — commits to `main` do NOT auto-deploy
- To deploy: merge `main` into `docs` branch and push

## Project Philosophy

- Zero dependencies at runtime beyond CDN (no npm install required to use)
- Works offline after first load (sql.js + IndexedDB persistence)
- No telemetry, no analytics, no server — your usage data stays in your browser
