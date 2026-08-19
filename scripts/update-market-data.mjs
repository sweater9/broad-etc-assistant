import { mkdir, readFile, writeFile } from 'node:fs/promises';

const instruments = {
  CSPX: { symbol: 'CSPX.L', isin: 'IE00B5BMR087' },
  EIMI: { symbol: 'EIMI.L', isin: 'IE00BKM4GZ66' },
  WSML: { symbol: 'WSML.L', isin: 'IE00BF4RFH31' }
};

const OUT = new URL('../data/market-history.json', import.meta.url);
const now = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

function parseYahoo(ticker, symbol, body) {
  const error = body?.chart?.error;
  if (error) throw new Error(`${ticker}: Yahoo ${error.code || 'error'} ${error.description || ''}`.trim());
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

async function requestYahoo(ticker, symbol, host) {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/127 Safari/537.36',
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Language': 'en-GB,en;q=0.9'
    },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${ticker}: ${host} HTTP ${response.status}`);
  return parseYahoo(ticker, symbol, await response.json());
}

async function fetchYahoo(ticker, symbol) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const errors = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const host of hosts) {
      try {
        return await requestYahoo(ticker, symbol, host);
      } catch (error) {
        errors.push(String(error.message || error));
      }
    }
    if (attempt < 2) await sleep(1500 * (attempt + 1));
  }
  throw new Error(`${ticker}: Yahoo hosts exhausted — ${errors.join(' | ')}`);
}

let previous = null;
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

const symbols = {};
const failures = [];
for (const [ticker, cfg] of Object.entries(instruments)) {
  try {
    symbols[ticker] = await fetchYahoo(ticker, cfg.symbol);
  } catch (error) {
    const reason = String(error.message || error);
    failures.push(reason);
    const cached = previous?.symbols?.[ticker];
    if (cached?.rows?.length >= 250) {
      const cachedQuality = validate(ticker, cached.rows);
      symbols[ticker] = { ...cached, quality: cachedQuality, fallbackReason: reason };
    }
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
