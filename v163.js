// V16.3 — LSE chart ingestion probe (safe: validates before storage)
(() => {
  const instruments = {
    CSPX: { isin: 'IE00B5BMR087', mic: 'XLON', url: 'https://www.londonstockexchange.com/stock/CSPX/ishares/company-page' },
    EIMI: { isin: 'IE00BKM4GZ66', mic: 'XLON', url: 'https://www.londonstockexchange.com/stock/EIMI/ishares/company-page' },
    WSML: { isin: 'IE00BF4RFH31', mic: 'XLON', url: 'https://www.londonstockexchange.com/stock/WSML/ishares/company-page' }
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function parseEmbeddedSeries(text) {
    // Probe only. Accept obvious date/value pairs if LSE exposes chart payload in fetched HTML.
    const pairs = [];
    const re = /(?:"date"|"time"|"x")\s*:\s*"?([^",}]+)"?[^{}]{0,120}?(?:"close"|"price"|"value"|"y")\s*:\s*"?([0-9]+(?:\.[0-9]+)?)/gi;
    let m;
    while ((m = re.exec(text)) && pairs.length < 400) {
      const d = new Date(m[1]); const close = Number(m[2]);
      if (!Number.isNaN(d.getTime()) && Number.isFinite(close) && close > 0) pairs.push({date:d.toISOString().slice(0,10), close});
    }
    const uniq = new Map(pairs.map(r => [r.date, r]));
    return [...uniq.values()].sort((a,b) => a.date.localeCompare(b.date));
  }

  async function probeOne(ticker) {
    const meta = instruments[ticker];
    try {
      const r = await fetch(meta.url, {cache:'no-store'});
      if (!r.ok) return {ticker, ok:false, reason:`HTTP ${r.status}`};
      const text = await r.text();
      const identity = text.includes(ticker) || text.includes(meta.isin);
      const rows = parseEmbeddedSeries(text);
      return {ticker, ok:true, identity, rows, bytes:text.length, reason: rows.length >= 200 ? 'Embedded daily series detected' : 'Page reachable; chart observations are not exposed as simple static date/value payload'};
    } catch (e) { return {ticker, ok:false, reason:e?.message || 'Fetch failed'}; }
  }

  async function runProbe() {
    const out = document.getElementById('lseChartProbeResult');
    const btn = document.getElementById('probeLseCharts');
    if (!out) return;
    if (btn) btn.disabled = true;
    out.innerHTML = 'Testing official LSE pages…';
    const results = [];
    for (const ticker of Object.keys(instruments)) results.push(await probeOne(ticker));
    const rows = results.map(x => `<tr><td><b>${x.ticker}</b></td><td>${x.ok ? 'Reachable' : 'Blocked'}</td><td>${x.identity ? 'Matched' : '—'}</td><td>${x.rows?.length || 0}</td><td>${esc(x.reason)}</td></tr>`).join('');
    out.innerHTML = `<div class="tablewrap"><table><thead><tr><th>ETF</th><th>LSE page</th><th>Identity</th><th>Parsed closes</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">V16.3 never stores or promotes observations unless the exact instrument identity and a sufficiently large daily series are detected. A reachable page alone is not treated as market data.</p>`;
    const promotable = results.filter(x => x.ok && x.identity && x.rows.length >= 200);
    promotable.forEach(x => localStorage.setItem(`priceHistory_${x.ticker}`, JSON.stringify({source:'LSE official chart page', isin:instruments[x.ticker].isin, mic:'XLON', rows:x.rows, ingestedAt:new Date().toISOString()})));
    if (promotable.length) window.dispatchEvent(new Event('storage'));
    if (btn) btn.disabled = false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const daily = document.getElementById('dailyIntel');
    if (!daily || document.getElementById('lseChartProbe')) return;
    const box = document.createElement('div');
    box.id = 'lseChartProbe'; box.className = 'why';
    box.innerHTML = `<b>Official LSE ingestion probe</b><p>Test whether this browser can retrieve recommendation-grade daily chart observations for the exact XLON listings. Nothing is accepted unless identity + ≥200 closes validate.</p><button id="probeLseCharts">Test LSE daily ingestion</button><div id="lseChartProbeResult" style="margin-top:12px">Not tested in this browser.</div>`;
    daily.appendChild(box);
    document.getElementById('probeLseCharts')?.addEventListener('click', runProbe);
  });
})();
