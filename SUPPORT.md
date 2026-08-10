# Support

If you need help with the DeepSeek Dashboard, please:

1. Check the [GitHub Issues](https://github.com/totalwindupflightsystems/deepseek-dashboard/issues) for known problems
2. Open a new issue with:
   - A description of the problem
   - Steps to reproduce
   - Your browser and version
   - Any console errors (F12 → Console tab)

## FAQ

**Q: The dashboard shows no data after uploading a CSV.**
Make sure you upload the `.zip` export from DeepSeek (direct CSV upload is rejected). The CSVs inside use a `utc_date` column with dates in YYYY-MM-DD format — not a "Date" column.

**Q: Charts don't render.**
This dashboard uses Chart.js loaded from CDN. Check your network connection and ad-blocker settings.

**Q: My data disappears when I refresh.**
Data is stored in your browser's IndexedDB database (via sql.js) — it survives reloads until you clear it. Clearing browser data will delete it, or use the Clear button in the workspace. Use the Export feature to save your data.
