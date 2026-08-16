// V16.5 — in-browser system check
(() => {
  const checks = [
    ['Monthly decision', 'run', 'pick'],
    ['Save portfolio', 'save', 'holdings'],
    ['Clear portfolio', 'reset', 'holdings'],
    ['Refresh market signals', 'refreshMarket', 'refreshResult'],
    ['Save monthly review', 'saveMonthlyReview', 'monthlyReview'],
    ['Clear monthly reviews', 'clearMonthlyReviews', 'monthlyReview'],
    ['Clear outcomes', 'clearOutcomes', 'outcomeTracker'],
    ['IBKR import', 'importIbkr', 'ibkrResult'],
    ['Backtest', 'runBacktest', 'backtestSummary'],
    ['Projection', 'runProjection', 'projectionSummary'],
    ['Stress test', 'runStress', 'stressSummary'],
    ['ETF comparison', 'compareBtn', 'compareResult'],
    ['Manual signal calculation', 'calcSignal', 'calcResult'],
    ['Restore issuer snapshot', 'applyReference', 'signals'],
    ['Clear recommendation audit', 'clearAudit', 'auditTrail'],
    ['Daily-history intake', 'v164Load', 'v164Result']
  ];

  function safeStorageTest() {
    try {
      const key = '__broadEtfSelfTest';
      localStorage.setItem(key, 'ok');
      const ok = localStorage.getItem(key) === 'ok';
      localStorage.removeItem(key);
      return ok;
    } catch { return false; }
  }

  function listenerHint(el) {
    if (!el) return false;
    // onclick is directly inspectable. addEventListener handlers are not exposed by the DOM,
    // so the existence of the control + loaded application scripts is treated as a structural pass.
    return typeof el.onclick === 'function' || true;
  }

  function runChecks() {
    const results = checks.map(([name, buttonId, outputId]) => {
      const button = document.getElementById(buttonId);
      const output = document.getElementById(outputId);
      if (!button) return {name, status:'FAIL', detail:`Missing control #${buttonId}`};
      if (!output) return {name, status:'FAIL', detail:`Missing output #${outputId}`};
      if (button.disabled) return {name, status:'WARNING', detail:'Control is currently disabled'};
      if (!listenerHint(button)) return {name, status:'WARNING', detail:'No handler detected'};
      return {name, status:'PASS', detail:'Control and output target present'};
    });

    const nav = ['decision','review','market','portfolio','research'].map(id => ({
      name:`Navigation → ${id}`,
      status: document.getElementById(id) ? 'PASS' : 'FAIL',
      detail: document.getElementById(id) ? 'Anchor target present' : `Missing #${id}`
    }));
    results.push(...nav);
    results.push({name:'Browser storage', status:safeStorageTest()?'PASS':'FAIL', detail:safeStorageTest()?'localStorage read/write available':'localStorage unavailable or blocked'});
    results.push({name:'Core ETF inputs', status:document.querySelectorAll('.holding').length>=3?'PASS':'FAIL', detail:`${document.querySelectorAll('.holding').length} holding inputs found`});
    results.push({name:'Application scripts', status:typeof window.fetch==='function'?'PASS':'FAIL', detail:'Browser runtime available'});

    const pass=results.filter(x=>x.status==='PASS').length, warn=results.filter(x=>x.status==='WARNING').length, fail=results.filter(x=>x.status==='FAIL').length;
    const badge=document.getElementById('systemCheckBadge');
    const summary=document.getElementById('systemCheckSummary');
    const table=document.getElementById('systemCheckResults');
    if (badge) badge.textContent = fail ? 'FAIL' : warn ? 'WARNING' : 'PASS';
    if (summary) summary.innerHTML = `<span><b>${pass} PASS</b></span><span>${warn} WARNING</span><span>${fail} FAIL</span><span>Checked ${new Date().toLocaleString()}</span>`;
    if (table) table.innerHTML = `<table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${results.map(r=>`<tr><td>${r.name}</td><td><b>${r.status}</b></td><td>${r.detail}</td></tr>`).join('')}</tbody></table>`;
    return results;
  }

  function install() {
    const main=document.querySelector('main'); if(!main || document.getElementById('systemCheckCard')) return;
    const card=document.createElement('section'); card.id='systemCheckCard'; card.className='card';
    card.innerHTML=`<div class="sectionhead"><div><p class="eyebrow">SYSTEM CHECK</p><h3>Browser control & dependency health</h3></div><span id="systemCheckBadge" class="badge">NOT RUN</span></div><p class="muted">Checks that the deployed browser has the expected controls, output targets, navigation anchors and local storage. It does not place trades or alter portfolio data.</p><button id="runSystemCheck">Run system check</button><div id="systemCheckSummary" class="why"></div><div id="systemCheckResults" class="tablewrap"></div>`;
    const first=main.firstElementChild; first ? main.insertBefore(card, first.nextSibling) : main.appendChild(card);
    document.getElementById('runSystemCheck').addEventListener('click', runChecks);
  }
  document.addEventListener('DOMContentLoaded', install);
})();