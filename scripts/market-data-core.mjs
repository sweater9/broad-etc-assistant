export const instruments = {
  CSPX: { symbol: 'CSPX.L', isin: 'IE00B5BMR087', currency: 'USD' },
  EIMI: { symbol: 'EIMI.L', isin: 'IE00BKM4GZ66', currency: 'USD' },
  WSML: { symbol: 'WSML.L', isin: 'IE00BF4RFH31', currency: 'USD' }
};
const DAY = 86400000;
export function validate(ticker, rows, now = Date.now(), { requireFresh = true } = {}) {
  if (!Array.isArray(rows) || rows.length < 250) throw new Error(`${ticker}: only ${rows?.length || 0} valid daily closes`);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(r?.d || '') ? Date.parse(r.d + 'T00:00:00Z') : NaN;
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== r.d || timestamp > now) throw new Error(`${ticker}: invalid or future date at row ${i}`);
    if (typeof r.p !== 'number' || !Number.isFinite(r.p) || r.p <= 0) throw new Error(`${ticker}: invalid close at row ${i}`);
    if (i && r.d <= rows[i - 1].d) throw new Error(`${ticker}: dates are not strictly increasing`);
  }
  const ageDays = Math.floor((now - Date.parse(rows.at(-1).d + 'T00:00:00Z')) / DAY);
  if (requireFresh && ageDays > 10) throw new Error(`${ticker}: latest close is ${ageDays} days old`);
  const jumps = rows.slice(1).filter((r, i) => Math.abs(r.p / rows[i].p - 1) > 0.50).length;
  if (jumps > 3) throw new Error(`${ticker}: ${jumps} daily moves above 50%; possible split/currency/data issue`);
  return { ageDays, jumps };
}
export function parseYahoo(ticker, cfg, body, now = Date.now()) {
  if (body?.chart?.error) throw new Error(`${ticker}: Yahoo returned a chart error`);
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error(`${ticker}: Yahoo returned no chart result`);
  if (result.meta?.symbol !== cfg.symbol || result.meta?.currency !== cfg.currency || result.meta?.exchangeName !== 'LSE') throw new Error(`${ticker}: wrong instrument, exchange or currency`);
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const rows = timestamps.flatMap((ts, i) => {
    // Null values denote a missing trading observation, never a zero close.
    if (!Number.isFinite(ts) || !Number.isFinite(closes[i])) return [];
    return [{ d: new Date(ts * 1000).toISOString().slice(0, 10), p: closes[i] }];
  });
  const quality = validate(ticker, rows, now);
  return { ticker, symbol: cfg.symbol, currency: cfg.currency, exchange: 'LSE', latestDate: rows.at(-1).d, observations: rows.length, quality, source: 'Yahoo Finance', rows };
}
export function retryDelay(value, attempt, now = Date.now(), random = Math.random) {
  const seconds = value?.trim() ? Number(value) : NaN;
  const date = Number.isFinite(seconds) ? now + seconds * 1000 : Date.parse(value || '');
  const serverDelay = Number.isFinite(date) ? Math.max(0, date - now) : 0;
  return Math.min(60000, Math.max(serverDelay, 5000 * 2 ** attempt) + Math.floor(random() * 1000));
}
export async function fetchYahoo(ticker, cfg, { fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), now = Date.now(), random = Math.random } = {}) {
  const errors = [];
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        const url = `https://${host}/v8/finance/chart/${encodeURIComponent(cfg.symbol)}?range=10y&interval=1d`;
        response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/127 Safari/537.36', Accept: 'application/json', 'Accept-Language': 'en-GB,en;q=0.9' }, signal: AbortSignal.timeout(20000) });
        if (response.ok) return parseYahoo(ticker, cfg, await response.json(), now);
        errors.push(`${host} HTTP ${response.status}`);
        await response.body?.cancel();
        // Retry temporary outages only; malformed data and permanent HTTP failures
        // move to the second host without repeatedly hammering the same endpoint.
        if (response.status !== 429 && response.status < 500) break;
      } catch (error) {
        errors.push(`${host}: ${error?.name === 'TimeoutError' ? 'timeout' : 'request or data validation failed'}`);
        if (response?.ok) break;
      }
      if (attempt < 2) await sleep(retryDelay(response?.headers?.get('retry-after'), attempt, now, random));
    }
  }
  throw new Error(`${ticker}: Yahoo hosts exhausted — ${errors.join(' | ')}`);
}
// Independent LSE USD closing-price feed. Keep the validated long history and
// require overlapping closes to agree before appending a recent provider window.
export function parseFT(ticker, cfg, html, cached, now = Date.now()) {
  const identity = `${ticker}:LSE:USD`;
  if (!html.includes(`<title>`) || !html.includes(identity) || !html.includes('historical prices - FT.com</title>')) throw new Error('FT instrument identity mismatch');
  if (cached?.symbol !== cfg.symbol || cached?.currency !== cfg.currency) throw new Error('FT requires matching validated base history');
  validate(ticker, cached.rows, now, { requireFresh: false });
  const table = html.match(/<table[^>]*class="[^"]*mod-tearsheet-historical-prices__results[^"]*"[^>]*>([\s\S]*?)<\/table>/)?.[1];
  if (!table || !/<th>Close<\/th>/.test(table)) throw new Error('FT closing-price table missing');
  const recent = [];
  for (const match of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    if (!cells.length) continue;
    if (cells.length !== 6) throw new Error('FT table columns changed');
    const label = cells[0].match(/<span class="mod-ui-hide-small-below">([^<]+)<\/span>/)?.[1];
    const date = Date.parse((label || '') + ' 00:00:00 GMT');
    const price = Number(cells[4].replace(/,/g, '').trim());
    if (!Number.isFinite(date) || !Number.isFinite(price) || price <= 0) throw new Error('FT invalid observation');
    recent.push({ d: new Date(date).toISOString().slice(0, 10), p: price });
  }
  recent.sort((a,b) => a.d.localeCompare(b.d));
  if (recent.length < 5) throw new Error('FT recent window too short');
  const old = new Map(cached.rows.map(r => [r.d, r.p]));
  const overlap = recent.filter(r => old.has(r.d));
  if (overlap.length < 3 || overlap.some(r => Math.abs(r.p / old.get(r.d) - 1) > 0.002)) throw new Error('FT overlap disagrees with cached USD closes');
  // Retain existing historical observations; append only newly observed sessions.
  const rows = [...cached.rows, ...recent.filter(r => r.d > cached.rows.at(-1).d)];
  const quality = validate(ticker, rows, now);
  return { ticker, symbol: cfg.symbol, currency: cfg.currency, exchange: 'LSE', latestDate: rows.at(-1).d, observations: rows.length, quality, source: 'Yahoo Finance history + Financial Times LSE USD closes', rows };
}
export async function fetchFT(ticker, cfg, cached, { fetchImpl = fetch, now = Date.now() } = {}) {
  const url = `https://markets.ft.com/data/etfs/tearsheet/historical?s=${ticker}:LSE:USD`;
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`FT HTTP ${response.status}`);
  return parseFT(ticker, cfg, await response.text(), cached, now);
}
export async function fetchHistoryWithFallback(ticker, cfg, cached) {
  try { return await fetchYahoo(ticker, cfg); }
  catch (yahooError) {
    try { return await fetchFT(ticker, cfg, cached); }
    catch (ftError) { throw new Error(`${yahooError.message}; ${ftError.message}`); }
  }
}
export async function refreshMarket(previous, { fetchHistory = fetchHistoryWithFallback, now = Date.now() } = {}) {
  const symbols = {}, diagnostics = {}, failures = [];
  for (const [ticker, cfg] of Object.entries(instruments)) {
    try {
      const fresh = await fetchHistory(ticker, cfg, previous?.symbols?.[ticker]);
      const quality = validate(ticker, fresh.rows, now);
      if (fresh.symbol !== cfg.symbol || fresh.currency !== cfg.currency) throw new Error('Instrument identity mismatch');
      const prior = previous?.symbols?.[ticker];
      if (prior?.latestDate && fresh.rows.at(-1).d < prior.latestDate) throw new Error('Upstream history regressed behind cached date');
      symbols[ticker] = { ...fresh, latestDate: fresh.rows.at(-1).d, observations: fresh.rows.length, quality, fetchedAt: new Date(now).toISOString() };
      diagnostics[ticker] = { status: 'fresh', latestDate: symbols[ticker].latestDate, observations: fresh.rows.length };
    } catch (error) {
      const reason = String(error.message || error);
      failures.push(reason);
      const cached = previous?.symbols?.[ticker];
      try {
        if (!cached || cached.symbol !== cfg.symbol || cached.currency !== cfg.currency) throw new Error('No matching cached history');
        const quality = validate(ticker, cached.rows, now, { requireFresh: false });
        symbols[ticker] = { ...cached, latestDate: cached.rows.at(-1).d, observations: cached.rows.length, quality, fallbackReason: reason };
        diagnostics[ticker] = { status: quality.ageDays > 10 ? 'stale-fallback' : 'cached-fallback', latestDate: symbols[ticker].latestDate, observations: cached.rows.length, reason };
      } catch (cachedError) { diagnostics[ticker] = { status: 'failed', reason, cachedError: cachedError.message }; }
    }
  }
  const complete = Object.keys(symbols).length === Object.keys(instruments).length;
  const successful = complete && failures.length === 0;
  const status = { generatedAt: new Date(now).toISOString(), complete, successful, source: [...new Set(Object.values(symbols).map(s => s.source))].join('; ') || 'Validated market cache', requiredInstruments: Object.keys(instruments), diagnostics, failures };
  const payload = { schemaVersion: 1, generatedAt: new Date(now).toISOString(), source: status.source, sourceType: 'server-side cached delayed market data', instruments, failures, symbols };
  return { status, payload, successful };
}
