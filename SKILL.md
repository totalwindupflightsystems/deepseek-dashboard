---
name: deepseek-dashboard
description: "DeepSeek API usage dashboard — single-file HTML/CSS/JS, Chart.js + JSZip, client-side only"
language: javascript
framework: vanilla
build: "none (single HTML file)"
test: "manual (browser-based)"
lint: "none (vanilla JS)"
deploy: "GitHub Pages (docs branch workflow)"
---

# DeepSeek Usage Dashboard

Single-file HTML dashboard for DeepSeek API usage data. Drag-and-drop ZIP ingestion, Chart.js visualizations, sql.js persistence via IndexedDB.

## Quickstart

```bash
# Open directly in browser
open index.html

# Or serve locally
python3 -m http.server 8080
```

## Project Structure

- `index.html` — entire application (~2,200 lines vanilla HTML/CSS/JS)
- `README.md` — user-facing documentation
- `.coding-hermes/tasks.md` — foreman task board
- Sample data ZIPs are gitignored (`*.zip`) — obtain from DeepSeek API Platform → Export Usage

## Tech Stack

- JSZip 3.10.1 (CDN)
- Chart.js 4.4.1 (CDN)
- sql.js 1.10.3 (CDN)
- Vanilla JS, CSS Grid + Flexbox
- No framework, no build step, no npm
