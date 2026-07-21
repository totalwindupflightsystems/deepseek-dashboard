---
name: deepseek-dashboard
description: "DeepSeek API usage dashboard — HTML/CSS/JS, Chart.js + JSZip, client-side only"
language: javascript
framework: vanilla
build: "none (static HTML/CSS/JS)"
test: "vitest 4.1.10 (jsdom)"
lint: "html-validate"
deploy: "GitHub Pages (docs branch workflow)"
---

# DeepSeek Usage Dashboard

Client-side HTML/CSS/JS dashboard for DeepSeek API usage data. Drag-and-drop ZIP ingestion, Chart.js visualizations, sql.js persistence via IndexedDB.

## Quickstart

```bash
# Open directly in browser
open index.html

# Or serve locally
python3 -m http.server 8080

# Run tests
npx vitest run
```

## Project Structure

- `index.html` — HTML shell + CDN imports (225 lines)
- `js/dashboard.js` — application logic (1,933 lines)
- `css/dashboard.css` — responsive layout + themes (321 lines)
- `tests/` — 6 test files + setup (749 lines, vitest + jsdom)
- `README.md` — user-facing documentation
- `.coding-hermes/tasks.md` — foreman task board
- `.github/workflows/` — CI pipeline (vitest + html-validate + deploy-check)
- Sample data ZIPs are gitignored (`*.zip`) — obtain from DeepSeek API Platform → Export Usage

## Tech Stack

- JSZip 3.10.1 (CDN)
- Chart.js 4.5.1 (CDN)
- sql.js 1.14.1 (CDN)
- Vanilla JS, CSS Grid + Flexbox
- No framework, no build step, no bundler
- Testing: vitest 4.1.10 + jsdom 29.1.1
