// V16.2 — Official LSE daily-data readiness layer
(() => {
  const instruments = {
    CSPX: { isin: 'IE00B5BMR087', mic: 'XLON', url: 'https://www.londonstockexchange.com/stock/CSPX/ishares/company-page' },
    EIMI: { isin: 'IE00BKM4GZ66', mic: 'XLON', url: 'https://www.londonstockexchange.com/stock/EIMI/ishares/company-page' },
    WSML: { isin: 'IE00BF4RFH31', mic: 'XLON', url: 'https://www.londonstockexchange.com/stock/WSML/ishares/company-page' }
  };

  function getStored(ticker) {
    try { return JSON.parse(localStorage.getItem(`priceHistory_${ticker}`) || 'null'); } catch { return null; }
  }

  function rowsFor(ticker) {
    const raw = getStored(ticker);
    if (!raw) return [];
    const rows = Array.isArray(raw) ? raw : (raw.rows || raw.history || raw.prices || []);
    return rows.map((x, i) => {
      if (typeof x === 'number') return { date: null, close: x };
      return { date: x.date || x.time || null, close: Number(x.close ?? x.price ?? x.value) };
    }).filter(x => Number.isFinite(x.close) && x.close > 0);
  }

  function latestDate(rows) {
    const dates = rows.map(r => r.date && new Date(r.date)).filter(d => d && !Number.isNaN(d.getTime()));
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map(d => d.getTime())));
  }

  function ageDays(date) { return date ? Math.floor((Date.now() - date.getTime()) / 86400000) : null; }

  function render() {
    const host = document.getElementById('dailyIntel');
    if (!host) return;
    const status = Object.entries(instruments).map(([ticker, meta]) => {
      const rows = rowsFor(ticker);
      const last = latestDate(rows);
      const age = ageDays(last);
      const enough = rows.length >= 200;
      const fresh = age !== null && age <= 7;
      return { ticker, meta, n: rows.length, last, age, enough, fresh, ready: enough && fresh };
    });
    const ready = status.filter(x => x.ready).length;
    const badge = document.getElementById('dailyIntelBadge');
    if (badge) badge.textContent = ready === 3 ? 'READY' : ready ? 'PARTIAL' : 'NEEDS HISTORY';
    const table = status.map(x => `<tr><td><b>${x.ticker}</b></td><td>${x.meta.isin}</td><td>${x.meta.mic}</td><td>${x.n}</td><td>${x.last ? x.last.toISOString().slice(0,10) : '—'}</td><td>${x.ready ? 'Recommendation-grade' : (x.enough ? 'Stale / check freshness' : 'Need ≥200 daily closes')}</td></tr>`).join('');
    host.innerHTML = `<div class="why"><b>V16.2 data policy:</b> Official LSE instrument identity is the preferred source. A series is only promoted to recommendation-grade when exact ISIN/MIC mapping, at least 200 valid daily closes and freshness checks pass. The app will not invent or substitute missing observations.</div><div class="tablewrap"><table><thead><tr><th>ETF</th><th>ISIN</th><th>MIC</th><th>Daily closes</th><th>Latest stored</th><th>Status</th></tr></thead><tbody>${table}</tbody></table></div><p class="muted">Official LSE pages expose roughly one trading year of daily chart observations. V16.2 prepares those observations for validation; direct browser ingestion remains gated until the chart-data request is proven stable and permitted.</p>`;
  }

  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('storage', render);
})();
