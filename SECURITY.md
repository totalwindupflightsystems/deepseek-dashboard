# Security Policy

## Supported Versions

The latest deployed version at [totalwindupflightsystems.github.io/deepseek-dashboard](https://totalwindupflightsystems.github.io/deepseek-dashboard) is the only supported version.

## Privacy Architecture

This dashboard processes ALL data client-side. No data is sent to any server:

- DeepSeek usage ZIPs are parsed in-browser via JSZip
- All aggregation, charting, and analysis is JavaScript running in your browser
- Uploaded usage data persists in IndexedDB per workspace (sql.js database, store `sqlite-db`) until you click **Clear** — it survives reloads but never leaves your browser
- The only external requests are version-pinned CDN loads (JSZip, Chart.js v4, sql.js)
- No analytics, telemetry, or tracking of any kind

## Reporting a Vulnerability

If you discover a security issue, please report it privately:

1. Email: wojonstech@gmail.com
2. Do NOT open a public issue
3. Include steps to reproduce and affected version

We aim to acknowledge reports within 72 hours and resolve within 30 days.

## Dependencies

This project has zero runtime npm dependencies. The only devDependencies are vitest and jsdom for testing. All runtime libraries (JSZip, Chart.js, sql.js) are loaded from CDN with integrity hashes where supported.
