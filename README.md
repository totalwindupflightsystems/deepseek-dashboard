# DeepSeek Usage Dashboard

**Your DeepSeek API usage, visualized. One HTML file. Zero servers. Nothing leaves your browser.**

## What This Is

DeepSeek's usage interface is the worst in the industry. OpenAI has a real-time dashboard. Anthropic has the Claude Console. OpenRouter has a full Analytics API. DeepSeek gives you a ZIP file.

This dashboard fixes that. Drag in your DeepSeek usage ZIP. Get charts, trends, and breakdowns. All processing happens in your browser — the data never touches any server.

## Privacy Guarantee

**Nothing leaves your browser. Period.**

- All parsing, aggregation, and charting is client-side JavaScript
- No analytics, no telemetry, no CDN calls that phone home
- CDN imports (JSZip, Chart.js) are the only external requests — both are version-pinned and from cdnjs
- OpenRouter comparison mode is opt-in and the API key never leaves your browser memory
- localStorage is used for theme, dashboard preferences, and workspace metadata — not for your DeepSeek usage data (that stays in SQL.js/IndexedDB)

**How to verify:** Open DevTools → Network tab. Drag in your ZIP. The only requests you'll see are the two CDN script loads (JSZip + Chart.js). Zero outbound data.

## Features

| Feature | |
|---|---|
| **Drag-drop ZIP ingestion** | JSZip extracts DeepSeek's `amount-*.csv` and `cost-*.csv` |
| **KPI cards** | Total cost, total tokens, total requests, average daily spend |
| **Token usage over time** | Stacked area chart: cache hit, cache miss, output tokens |
| **Daily spend** | Stacked bar chart by model (V4 Pro vs V4 Flash) |
| **Per-model breakdown** | Doughnut chart with cost per model |
| **Prompt vs completion ratio** | Visual breakdown of input vs output token split |
| **Top spend days** | Ranked list of highest-cost days |
| **Per-key spend** | Horizontal bar chart breaking down cost by API key |
| **Raw data table** | Searchable, filterable table with all parsed rows |
| **Period filter** | All time, last 7/30 days, or per-month |
| **Model/Key filters** | Drill down by model or API key |
| **CSV export** | Export cleaned, aggregated data |
| **OpenRouter comparison** | Optional: paste your OR API key to overlay usage curves |
| **Pricing verification** | Auto-checks export pricing against known rates |
| **Dark theme** | Responsive, mobile-friendly |

## Live Demo

**🔗 [totalwindupflightsystems.github.io/deepseek-dashboard](https://totalwindupflightsystems.github.io/deepseek-dashboard/)**

Just open the link — no install, no signup, nothing. Your data stays in your browser.

## How to Use

1. Go to [DeepSeek Platform → Usage](https://platform.deepseek.com/usage)
2. Pick a month → Click **Export** → Download the ZIP
3. Open the dashboard (link above, or download `index.html` and open locally)
4. Create a workspace (e.g. "Personal", "Work")
5. Drag the ZIP file onto the page
6. That's it. Upload again anytime — diffs are managed automatically.

**Multi-account?** Create multiple workspaces and switch between them. Data is isolated per workspace.

## How to Verify the Code

It's one file. Open `index.html` in any text editor. Read it. No obfuscation, no minification, no hidden requests. The entire application is ~2,400 lines of vanilla HTML/CSS/JS.

## Tech Stack

- **JSZip 3.10.1** — ZIP extraction (CDN, version-pinned)
- **Chart.js 4.4.1** — Visualizations (CDN, version-pinned)
- **sql.js 1.10.3** — SQLite persistence via IndexedDB for workspaces and usage data
- **Vanilla JS** — No framework, no build step, no npm, no bundler
- **CSS Grid + Flexbox** — Responsive layout, no CSS framework

## Data Format

DeepSeek exports two CSVs inside the ZIP:

- **`amount-YYYY-M.csv`** — Per-API-key token breakdown with type (cache hit, cache miss, output, request count), per-unit pricing, and counts
- **`cost-YYYY-M.csv`** — Per-model daily cost totals in USD

The dashboard parses both, cross-references pricing, and presents the complete picture.

## Sample Data

The repository includes a real June 2026 usage export showing:
- **$380.08** total spend over 22 days
- **16.25 billion** total tokens
- **174,766** API requests
- **9 active API keys**
- **2 models:** deepseek-v4-pro, deepseek-v4-flash
- **174:1 prompt-to-completion ratio** (DeepSeek's massive context + aggressive caching at work)

## Known Limitations

- Works with DeepSeek's current export format (June 2026). If they change column names, fuzzy matching handles most cases, but radical format changes may need a code update.
- OpenRouter comparison loads last 30 days of data — limited to what the OpenRouter Analytics API returns.
- Very large exports (6+ months of heavy usage) may cause browser memory pressure. The dashboard processes everything in-memory.

## License

MIT — do whatever you want. No attribution required, but appreciated.
