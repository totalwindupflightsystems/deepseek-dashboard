# Coding Hermes Tasks — deepseek-dashboard

## Active

### [P1] Clarify input vs output token usage visuals
**Context:** The dashboard charts mix input tokens (cache hit + cache miss) and output tokens without clear visual distinction. Users can't easily see input vs output split.

**Requirements:**
1. In "Token Usage Over Time" chart: make clear which lines are INPUT (cache hit + cache miss combined into one INPUT line, or keep separate but group) vs OUTPUT. Add a stacked area or clearer legend.
2. In "Prompt vs Completion" chart: rename to "Input vs Output Tokens" for clarity. Ensure the labels say "Input Tokens" and "Output Tokens" not prompt/completion.
3. In KPI cards at top: clearly distinguish input from output token counts. Add an "Output / Input" ratio percentage if useful.
4. In raw data table: ensure the "type" column values are human-readable (e.g., "Input (Cache Hit)" instead of "input_cache_hit_tokens").
5. The spend chart should show cost split between input and output.

### [P2] Color alignment and chart polish
**Context:** Chart colors need to be consistent and professional. The current dark theme should have colors that pop against #0d1117 background with good contrast.

**Requirements:**
1. Establish a consistent color palette across all 6 charts:
   - INPUT tokens: a warm/blue color (#4c6ef5 or similar)
   - OUTPUT tokens: a complementary accent (#39d2c0 or similar)
   - Spend: orange/gold (#d2991d)
   - Models: distinct hues that work on dark bg
2. Fix chart styling: proper grid colors (#21262d), axis label visibility, tooltip formatting
3. KPI cards: add subtle color accents matching the chart palette
4. Ensure colorblind-friendly palette (avoid red-green only distinctions)
5. Chart titles should be more descriptive
6. The "No data yet" state on charts should show proper empty-state placeholders

### [P3] Visual polish and desktop/mobile refinements
**Context:** "graphs look cheap on desktop" — need professional chart styling.

**Requirements:**
1. Chart.js options polish:
   - Rounded corners on bars (borderRadius: 4)
   - Proper font sizes for labels (9px desktop, 8px mobile)
   - Consistent padding and margins
   - Hover effects that show clear data points
2. The "filters panel with × button showing on desktop" — ensure mobile bottom-sheet doesn't leak to desktop
3. Drop zone: improve the "empty state" with a more helpful message about what data format is expected
4. Workspace selector: ensure dropdown width accommodates longer names
5. Raw data table: the cost column gets clipped — add horizontal scroll indicator

## Backlog

- Model distribution over time (stacked area chart)
- Anomaly detection / spike alerts
- Per-hour granularity option
- Rate limit monitoring panel

## Completed

- ✅ Dedup fix: overlapping date range detection (commit 6163283)
- ✅ P6: Mobile refinements — swipe to dismiss toast, bottom sheet for filters (commit 9036365)
- ✅ P4: Token pricing calculator (commit cfec1a7)
- ✅ P5: Dark/light theme toggle (commit 85ff11c)
- ✅ P3: Virtual scrolling for large data (commit 12dd2f8)
- ✅ P2: Multiple file upload support (commit 35edc1d)
- ✅ Single-file HTML dashboard with Chart.js + JSZip
- ✅ sql.js persistence via IndexedDB
- ✅ Multi-workspace support (create/rename/delete/switch)
- ✅ Diff management on re-upload (replace matching date range)
- ✅ Clear button per workspace
- ✅ Upload history log
- ✅ KPI cards + 6 chart panels
- ✅ CSV export (aggregated + raw)
- ✅ GitHub Pages deployment
- ✅ P1: OpenRouter comparison overlay — fetch OR Analytics API data, overlay dashed usage curves on Token and Spend charts, handle API errors, comparison KPI card (commit a2c5e71)
- ✅ P2: Chart export as PNG — download button on each Chart.js chart card, toBase64Image(), filename includes chart type + date range
