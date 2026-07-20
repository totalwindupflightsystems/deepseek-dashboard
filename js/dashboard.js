'use strict';

// -- Utilities --
function fmtUSD(n) { return '$' + Number(n).toFixed(2); }
function fmtTok(n) {
  n = Number(n);
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return Math.round(n).toLocaleString();
}
function fmtNum(n) { return Math.round(Number(n)).toLocaleString(); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// -- CSV Parser --
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '').trim();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = []; let cur = '', inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    if (vals.length !== headers.length) continue;
    const row = {}; headers.forEach((h,j) => row[h] = vals[j]); rows.push(row);
  }
  return rows;
}

// -- Date grouping helpers --
function getISOWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7; // 1=Mon..7=Sun
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function groupDays(days, granularity) {
  if (!days || !days.length || granularity === 'daily') return days;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const groups = {};
  for (const d of days) {
    let key, label;
    if (granularity === 'weekly') {
      key = getISOWeekStart(d.date);
      const monday = new Date(key + 'T00:00:00');
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const sm = MONTHS[monday.getMonth()];
      const em = MONTHS[sunday.getMonth()];
      label = sm === em
        ? `${sm} ${monday.getDate()}-${sunday.getDate()}`
        : `${sm} ${monday.getDate()} - ${em} ${sunday.getDate()}`;
    } else if (granularity === 'monthly') {
      key = d.date.slice(0, 7);
      const [y, m] = key.split('-');
      label = `${MONTHS[parseInt(m)-1]} ${y}`;
    }
    if (!groups[key]) {
      groups[key] = { label, date: d.date, cost_tokens: 0, cost_csv: 0, total_tokens: 0, cache_hit: 0, cache_miss: 0, output: 0, prompt: 0, requests: 0, byModel: {} };
    }
    const g = groups[key];
    g.cost_tokens += d.cost_tokens;
    g.cost_csv += d.cost_csv;
    g.total_tokens += d.total_tokens;
    g.cache_hit += d.cache_hit;
    g.cache_miss += d.cache_miss;
    g.output += d.output;
    g.prompt += d.prompt;
    g.requests += d.requests;
    for (const [model, v] of Object.entries(d.byModel)) {
      if (!g.byModel[model]) g.byModel[model] = { cost:0, tokens:0, cache_hit:0, cache_miss:0, output:0, requests:0, input_cost:0, output_cost:0 };
      g.byModel[model].cost += v.cost;
      g.byModel[model].tokens += v.tokens;
      g.byModel[model].cache_hit += v.cache_hit;
      g.byModel[model].cache_miss += v.cache_miss;
      g.byModel[model].output += v.output;
      g.byModel[model].requests += v.requests;
      g.byModel[model].input_cost += (v.input_cost || 0);
      g.byModel[model].output_cost += (v.output_cost || 0);
    }
  }
  return Object.values(groups).sort((a,b) => a.date.localeCompare(b.date));
}

// -- Anomaly Detection --
function detectAnomalies(days, threshold, metrics) {
  if (!days || !days.length) return {items: [], dates: new Set()};
  const items = [];
  const dates = new Set();

  function _zTest(vals, label) {
    const n = vals.length;
    const mean = vals.reduce((s,v) => s+v, 0) / n;
    const std = Math.sqrt(vals.reduce((s,v) => s+(v-mean)*(v-mean), 0) / n);
    if (std < 1e-12) return;
    vals.forEach((v, i) => {
      const z = Math.abs((v - mean) / std);
      if (z > threshold) {
        items.push({date: days[i].date, metric: label, value: v, zScore: z});
        dates.add(days[i].date);
      }
    });
  }

  if (metrics.cost) _zTest(days.map(d => d.cost_csv || d.cost_tokens), 'Cost');
  if (metrics.tokens) _zTest(days.map(d => d.total_tokens), 'Tokens');
  if (metrics.requests) _zTest(days.map(d => d.requests), 'Requests');

  items.sort((a,b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric));
  return {items, dates};
}

// -- Pricing Calculator --
const PRICING_LS_KEY = 'ds-dash-custom-prices';

function loadCustomPrices() {
  try { return JSON.parse(localStorage.getItem(PRICING_LS_KEY) || '{}'); } catch(e) { return {}; }
}
function saveCustomPrices(prices) {
  try { localStorage.setItem(PRICING_LS_KEY, JSON.stringify(prices)); } catch(e) {}
}

function getPricingModels() {
  if (!activeWsId) return [];
  const r = db.exec('SELECT DISTINCT model FROM token_usage WHERE workspace_id = ? ORDER BY model', [activeWsId]);
  return r.length ? r[0].values.map(v => v[0]) : [];
}

function getAvgPriceForModel(model) {
  if (!activeWsId) return { input: 0, output: 0, cache_hit: 0 };
  const prices = { input: 0, output: 0, cache_hit: 0 };
  const r = db.exec('SELECT type, AVG(price) FROM token_usage WHERE workspace_id = ? AND model = ? AND price > 0 GROUP BY type', [activeWsId, model]);
  if (r.length) {
    for (const [typ, avg] of r[0].values) {
      const val = Number(avg) || 0;
      if (typ === 'output_tokens') prices.output = val;
      else if (typ === 'input_cache_hit_tokens') prices.cache_hit = val;
      else if (typ.startsWith('input')) prices.input = val;
    }
  }
  return prices;
}

function collectPricesFromInputs() {
  const prices = {};
  document.querySelectorAll('#pricingModelRows input').forEach(inp => {
    const model = inp.dataset.model;
    const ptype = inp.dataset.ptype;
    const val = parseFloat(inp.value);
    if (!prices[model]) prices[model] = { input: 0, output: 0, cache_hit: 0 };
    prices[model][ptype] = isNaN(val) || val < 0 ? 0 : val;
  });
  return prices;
}

function recalcPricing() {
  if (!activeWsId) return;
  const prices = collectPricesFromInputs();
  saveCustomPrices(prices);

  const r = db.exec(`SELECT model, type, amount, price FROM token_usage WHERE workspace_id = ? AND type != 'request_count'`, [activeWsId]);
  if (!r.length || !r[0].values.length) {
    // toast is not available in test context
    if (typeof toast !== 'undefined') toast('No token rows to calculate', true);
    return;
  }

  const rows = r[0].values;
  let totalOrig = 0, totalNew = 0;
  const byModel = {};

  for (const [model, typ, amount, price] of rows) {
    const amt = Number(amount) || 0;
    const origCost = (Number(price) || 0) * amt;
    totalOrig += origCost;

    const mp = prices[model];
    let customPrice = 0;
    if (mp) {
      if (typ === 'output_tokens') customPrice = mp.output;
      else if (typ === 'input_cache_hit_tokens') customPrice = mp.cache_hit;
      else if (typ.startsWith('input')) customPrice = mp.input;
    }
    const newCost = customPrice * amt;
    totalNew += newCost;

    if (!byModel[model]) byModel[model] = { orig: 0, new: 0 };
    byModel[model].orig += origCost;
    byModel[model].new += newCost;
  }

  const diff = totalNew - totalOrig;
  const pctChange = totalOrig > 0 ? ((diff / totalOrig) * 100).toFixed(1) : '0.0';

  // Update DOM elements if present
  const origEl = document.getElementById('pricingOrigCost');
  if (origEl) origEl.textContent = fmtUSD(totalOrig);
  const newEl = document.getElementById('pricingNewCost');
  if (newEl) newEl.textContent = fmtUSD(totalNew);

  const diffEl = document.getElementById('pricingDiff');
  if (diffEl) diffEl.textContent = (diff >= 0 ? '+' : '') + fmtUSD(diff) + ' (' + (diff >= 0 ? '+' : '') + pctChange + '%)';

  const diffItem = document.getElementById('pricingDiffItem');
  if (diffItem) {
    diffItem.classList.remove('diff-positive', 'diff-negative');
    if (diff > 0.005) diffItem.classList.add('diff-positive');
    else if (diff < -0.005) diffItem.classList.add('diff-negative');
  }

  const tbody = document.querySelector('#pricingBreakdown tbody');
  if (tbody) {
    const modelEntries = Object.entries(byModel).sort((a, b) => (b[1].new - b[1].orig) - (a[1].new - a[1].orig));
    tbody.innerHTML = modelEntries.map(([model, costs]) => {
      const md = costs.new - costs.orig;
      const mdClass = md > 0.005 ? 'diff-pos' : (md < -0.005 ? 'diff-neg' : '');
      return '<tr>\n' +
        '      <td>' + escapeHtml(model) + '</td>\n' +
        '      <td class="num">' + fmtUSD(costs.orig) + '</td>\n' +
        '      <td class="num">' + fmtUSD(costs.new) + '</td>\n' +
        '      <td class="num ' + mdClass + '">' + (md >= 0 ? '+' : '') + fmtUSD(md) + '</td>\n' +
        '    </tr>';
    }).join('');
  }

  const resultsEl = document.getElementById('pricingResults');
  if (resultsEl) resultsEl.classList.add('show');

  return { totalOrig, totalNew, diff, pctChange, byModel };
}
