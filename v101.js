// V10.1 — recommendation audit trail
(() => {
  const KEY = 'broadEtfRecommendationAuditV101';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const text = id => document.getElementById(id)?.textContent?.trim() || '';
  const getAudit = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const saveAudit = rows => localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 36)));

  function currentInputs(){
    const tickers = ['CSPX','EIMI','WSML'];
    const fundamentals = {};
    tickers.forEach(t => {
      const pe = document.querySelector(`[data-ticker="${t}"][data-field="pe"]`);
      const pb = document.querySelector(`[data-ticker="${t}"][data-field="pb"]`);
      fundamentals[t] = { pe: num(pe?.value), pb: num(pb?.value) };
    });
    let market = {};
    try {
      const raw = JSON.parse(localStorage.getItem('broadEtfPriceHistory') || '{}');
      tickers.forEach(t => {
        const series = raw[t];
        if (Array.isArray(series) && series.length) {
          const vals = series.map(x => typeof x === 'number' ? x : Number(x.close ?? x.Close ?? x.price)).filter(Number.isFinite);
          if (vals.length) {
            const latest = vals.at(-1), window = vals.slice(-252), high = Math.max(...window);
            market[t] = { latest, high52w: high, drawdownPct: high ? ((latest/high)-1)*100 : null, observations: vals.length };
          }
        }
      });
    } catch {}
    const holdings = {};
    document.querySelectorAll('.holding').forEach(el => { const k = el.dataset.ticker || el.name || el.id; if(k) holdings[k] = num(el.value) || 0; });
    return { budget: num(document.getElementById('budget')?.value), fundamentals, market, holdings };
  }

  function capture(){
    const pick = text('pick');
    const score = text('score');
    if (!pick || pick === '—') return;
    const entry = {
      id: Date.now(), at: new Date().toISOString(), pick, score,
      signal: text('signal'), reason: text('reason'), confidence: text('dataStatus'),
      sourceHealth: text('sourceHealthBadge'), inputs: currentInputs()
    };
    const rows = getAudit();
    const last = rows[0];
    if (last && last.pick === entry.pick && last.score === entry.score && Date.now()-last.id < 30000) return;
    rows.unshift(entry); saveAudit(rows); render();
  }

  function render(){
    const host = document.getElementById('auditTrail'); if(!host) return;
    const rows = getAudit();
    if(!rows.length){ host.innerHTML = '<p class="muted">No audited decisions yet. Run this month\'s decision to create the first record.</p>'; return; }
    host.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Decision</th><th>Score</th><th>Confidence</th><th>Feed</th><th>Contribution</th><th>Reason</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(new Date(r.at).toLocaleString())}</td><td><b>${esc(r.pick)}</b><small>${esc(r.signal)}</small></td><td>${esc(r.score)}</td><td>${esc(r.confidence||'—')}</td><td>${esc(r.sourceHealth||'—')}</td><td>AED ${esc(r.inputs?.budget ?? '—')}</td><td>${esc(r.reason||'—')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    const run = document.getElementById('run');
    if(run) run.addEventListener('click', () => setTimeout(capture, 80));
    const clear = document.getElementById('clearAudit');
    if(clear) clear.addEventListener('click', () => { if(confirm('Clear the local recommendation audit trail on this browser?')) { localStorage.removeItem(KEY); render(); } });
  });
})();
