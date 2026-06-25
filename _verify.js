const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>[\s\S]*?<\/script>/g);
const bigScript = match.filter(s => s.includes('async function init'))[0];
const code = bigScript.replace(/<script>/, '').replace(/<\/script>/, '');
try {
  new Function(code);
  console.log('✅ JS syntax OK');
} catch(e) {
  console.error('❌ Syntax error:', e.message);
  process.exit(1);
}
// Check all required functions/features
const checks = [
  ['setTheme function', code.includes('function setTheme(')],
  ['loadTheme function', code.includes('function loadTheme(')],
  ['themeToggle click handler', code.includes('addEventListener') && code.includes('themeToggle')],
  ['localStorage save', code.includes('ds-dash-theme') && code.includes('setItem')],
  ['localStorage load', code.includes('ds-dash-theme') && code.includes('getItem')],
  ['loadTheme called in init', code.includes('loadTheme();')],
  ['data-theme attribute set', code.includes('setAttribute') && code.includes('data-theme')],
];
let ok = true;
for (const [label, pass] of checks) {
  console.log(pass ? '✅' : '❌', label);
  if (!pass) ok = false;
}
// Check light theme CSS exists
if (html.includes(':root[data-theme="light"]')) console.log('✅ Light theme CSS variables');
else { console.log('❌ Light theme CSS variables missing'); ok = false; }
// Check flash-prevention script
const firstScriptStart = html.indexOf('<script>');
const cdnIndex = html.indexOf('<script src=');
if (html.includes('ds-dash-theme') && firstScriptStart < cdnIndex) console.log('✅ Flash-prevention inline script present');
else { console.log('❌ Flash-prevention inline script missing/incorrect'); ok = false; }
if (ok) console.log('\n✅ All checks passed');
else process.exit(1);
