import { mkdir, readFile, writeFile } from 'node:fs/promises';

const instruments = {
  CSPX: { symbol: 'CSPX.L', isin: 'IE00B5BMR087' },
  EIMI: { symbol: 'EIMI.L', isin: 'IE00BKM4GZ66' },
  WSML: { symbol: 'WSML.L', isin: 'IE00BF4RFH31' }
};

const OUT = new URL('../data/market-history.json', import.meta.url);
const now = Date.now();

function ymd(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function validate(ticker, rows) {
  if (rows.length < 250) throw new Error(`${ticker}: only ${rows.length} valid daily closes`);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].d <= rows[i - 1].d) throw new Error(`${ticker}: dates are not strictly increasing`);
  }
  const latest = new Date(rows.at(-1).d + 'T00:00:00Z').getTime();
  const ageDays = Math.floor((now - latest) / 86400000);
  if (ageDays > 10) throw new Error(`${ticker}: latest close is ${ageDays} days old`);
  const jumps = rows.slice(1).filter((r, i) => Math.abs(r.p / rows[i].p - 1) > 0.50).length;
  return { ageDays, jumps };
}

async function fetchYahoo(ticker, symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BroadETFProductionCache/1.0' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${ticker}: Yahoo HTTP ${response.status}`);
  const body = await response.json();
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error(`${ticker}: Yahoo returned no chart result`);
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const rows = timestamps.map((ts, i) => ({ d: ymd(ts), p: Number(closes[i]) }))
    .filter(r => r.d && Number.isFinite(r.p) && r.p > 0);
  const quality = validate(ticker, rows);
  return {
    ticker,
    symbol,
    currency: result.meta?.currency || null,
    exchange: result.meta?.exchangeName || result.meta?.fullExchangeName || 'LSE',
    latestDate: rows.at(-1).d,
    observations: rows.length,
    quality,
    rows
  };
}

let previous = null;
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

const symbols = {};
const failures = [];
for (const [ticker, cfg] of Object.entries(instruments)) {
  try {
    symbols[ticker] = await fetchYahoo(ticker, cfg.symbol);
  } catch (error) {
    failures.push(String(error.message || error));
    const cached = previous?.symbols?.[ticker];
    if (cached?.rows?.length >= 250) symbols[ticker] = { ...cached, fallbackReason: String(error.message || error) };
  }
}

if (Object.keys(symbols).length !== Object.keys(instruments).length) {
  throw new Error(`Market cache update incomplete: ${failures.join(' | ')}`);
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'Yahoo Finance chart cache',
  sourceType: 'server-side cached delayed market data',
  instruments: Object.fromEntries(Object.entries(instruments).map(([k, v]) => [k, { symbol: v.symbol, isin: v.isin }])),
  failures,
  symbols
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Updated ${OUT.pathname}: ${Object.values(symbols).map(x => `${x.ticker} ${x.observations} @ ${x.latestDate}`).join(' | ')}`);
if (failures.length) console.warn(`Used cached fallback for: ${failures.join(' | ')}`);
