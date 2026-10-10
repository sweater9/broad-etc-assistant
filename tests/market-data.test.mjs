import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFT, parseFT, fetchYahoo, instruments, parseYahoo, refreshMarket, retryDelay, validate } from '../scripts/market-data-core.mjs';
const now = Date.parse('2026-10-10T12:00:00Z');
const rows = (daysOld = 1) => Array.from({ length: 260 }, (_, i) => ({ d: new Date(now - (daysOld + 259 - i) * 86400000).toISOString().slice(0, 10), p: 100 + i / 10 }));
const history = (ticker, daysOld = 1) => ({ ticker, symbol: instruments[ticker].symbol, currency: 'USD', exchange: 'LSE', latestDate: rows(daysOld).at(-1).d, rows: rows(daysOld) });
const body = (ticker) => ({ chart: { result: [{ meta: { symbol: instruments[ticker].symbol, currency: 'USD', exchangeName: 'LSE' }, timestamp: rows().map(r => Date.parse(r.d) / 1000), indicators: { quote: [{ close: rows().map(r => r.p) }] } }] } });
test('valid USD LSE history loads and wrong currency or instrument fails', () => {
  assert.equal(parseYahoo('CSPX', instruments.CSPX, body('CSPX'), now).observations, 260);
  const wrong = body('CSPX'); wrong.chart.result[0].meta.currency = 'GBP';
  assert.throws(() => parseYahoo('CSPX', instruments.CSPX, wrong, now), /wrong instrument/);
  assert.throws(() => parseYahoo('EIMI', instruments.EIMI, body('CSPX'), now), /wrong instrument/);
});
test('invalid dates, future dates, order, negative prices and stale downloads fail', () => {
  for (const value of ['2026-02-30', '2026-10-11', 'nonsense']) {
    const r = rows(); r[0].d = value; assert.throws(() => validate('CSPX', r, now));
  }
  const r = rows(); r[10].d = r[9].d; assert.throws(() => validate('CSPX', r, now), /increasing/);
  r[10].d = rows()[10].d; r[10].p = -1; assert.throws(() => validate('CSPX', r, now), /invalid close/);
  assert.throws(() => validate('CSPX', rows(12), now), /days old/);
});
test('429 honors Retry-After before retrying', async () => {
  const waits = []; let calls = 0;
  const result = await fetchYahoo('CSPX', instruments.CSPX, { now, random: () => 0, sleep: async ms => waits.push(ms), fetchImpl: async () => ++calls === 1 ? new Response('', { status: 429, headers: { 'retry-after': '30' } }) : Response.json(body('CSPX')) });
  assert.equal(result.ticker, 'CSPX'); assert.deepEqual(waits, [30000]); assert.equal(calls, 2);
  assert.equal(retryDelay(new Date(now + 20000).toUTCString(), 0, now, () => 0), 20000);
  assert.equal(retryDelay('9999', 0, now, () => 0), 60000);
});
test('permanent error skips retry and uses alternate host', async () => {
  const urls = [];
  const result = await fetchYahoo('CSPX', instruments.CSPX, { now, sleep: async () => assert.fail('unexpected retry'), fetchImpl: async url => { urls.push(url); return urls.length === 1 ? new Response('', { status: 404 }) : Response.json(body('CSPX')); } });
  assert.equal(result.ticker, 'CSPX'); assert.match(urls[1], /query2/); assert.equal(urls.length, 2);
});
test('all-host outage is bounded and fails instead of inventing data', async () => {
  let calls = 0; const waits = [];
  await assert.rejects(fetchYahoo('CSPX', instruments.CSPX, { now, random: () => 0, sleep: async ms => waits.push(ms), fetchImpl: async () => { calls++; return new Response('', { status: 429 }); } }), /hosts exhausted/);
  assert.equal(calls, 6); assert.deepEqual(waits, [5000,10000,5000,10000]);
});
test('successful refresh covers every core instrument', async () => {
  const result = await refreshMarket(null, { now, fetchHistory: async t => history(t) });
  assert.equal(result.successful, true); assert.equal(result.status.complete, true);
  assert.deepEqual(Object.keys(result.payload.symbols), ['CSPX','EIMI','WSML']);
});
test('partial refresh preserves successes and stale history with honest failure status', async () => {
  const old = history('EIMI', 40); old.fetchedAt = '2026-08-01T00:00:00Z';
  const previous = { symbols: { EIMI: old } };
  const result = await refreshMarket(previous, { now, fetchHistory: async t => { if (t === 'EIMI') throw new Error('HTTP 429'); return history(t); } });
  assert.equal(result.successful, false); assert.equal(result.status.complete, true);
  assert.equal(result.status.diagnostics.EIMI.status, 'stale-fallback');
  assert.equal(result.payload.symbols.EIMI.fetchedAt, old.fetchedAt);
  assert.equal(result.payload.symbols.CSPX.latestDate, '2026-10-09');
  assert.deepEqual(previous.symbols.EIMI, old);
});
test('missing cache and regressed upstream never lose other downloaded series', async () => {
  const result = await refreshMarket(null, { now, fetchHistory: async t => { if (t === 'EIMI') throw new Error('outage'); return history(t); } });
  assert.equal(result.status.complete, false); assert.equal(result.successful, false);
  assert.ok(result.payload.symbols.CSPX); assert.ok(result.payload.symbols.WSML);
  const regressed = await refreshMarket({ symbols: { CSPX: history('CSPX') } }, { now, fetchHistory: async t => history(t, 2) });
  assert.equal(regressed.status.diagnostics.CSPX.status, 'cached-fallback');
  assert.equal(regressed.payload.symbols.CSPX.latestDate, '2026-10-09');
});

const ftHTML = (prices, ticker = 'CSPX') => `<title>${ticker}:LSE:USD historical prices - FT.com</title><table class="mod-tearsheet-historical-prices__results"><th>Close</th>${prices.map(r => `<tr><td><span class="mod-ui-hide-small-below">${new Date(r.d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit', timeZone: 'UTC' })}</span></td><td>1</td><td>1</td><td>1</td><td>${r.p}</td><td>1</td></tr>`).join('')}</table>`;
test('independent closing feed appends without rewriting history and checks overlap', async () => {
  const cached = history('CSPX', 2);
  const recent = [...cached.rows.slice(-5), { d: '2026-10-09', p: 126 }];
  const html = ftHTML(recent);
  const parsed = parseFT('CSPX', instruments.CSPX, html, cached, now);
  assert.equal(parsed.latestDate, '2026-10-09');
  assert.deepEqual(parsed.rows.slice(0, -1), cached.rows);
  assert.throws(() => parseFT('EIMI', instruments.EIMI, html, cached, now), /identity/);
  assert.throws(() => parseFT('CSPX', instruments.CSPX, ftHTML(recent.map(r => ({ ...r, p: r.p * 100 }))), cached, now), /overlap/);
  assert.throws(() => parseFT('CSPX', instruments.CSPX, html, null, now), /base history/);
  const fetched = await fetchFT('CSPX', instruments.CSPX, cached, { now, fetchImpl: async () => new Response(html) });
  assert.equal(fetched.latestDate, parsed.latestDate);
  await assert.rejects(fetchFT('CSPX', instruments.CSPX, cached, { now, fetchImpl: async () => new Response('', { status: 503 }) }), /HTTP 503/);
});
