// V16.5.1 — in-browser system check with explicit failure reporting
(() => {
  const checks = [
    ['Monthly decision', 'run', 'pick'], ['Save portfolio', 'save', 'holdings'], ['Clear portfolio', 'reset', 'holdings'],
    ['Refresh market signals', 'refreshMarket', 'refreshResult'], ['Save monthly review', 'saveMonthlyReview', 'monthlyReview'],
    ['Clear monthly reviews', 'clearMonthlyReviews', 'monthlyReview'], ['Clear outcomes', 'clearOutcomes', 'outcomeTracker'],
    ['IBKR import', 'importIbkr', 'ibkrResult'], ['Backtest', 'runBacktest', 'backtestSummary'],
    ['Projection', 'runProjection', 'projectionSummary'], ['Stress test', 'runStress', 'stressSummary'],
    ['ETF comparison', 'compareBtn', 'compareResult'], ['Manual signal calculation', 'calcSignal', 'calcResult'],
    ['Restore issuer snapshot', 'applyReference', 'signals'], ['Clear recommendation audit', 'clearAudit', 'auditTrail'],
    ['Daily-history intake', 'v164Load', 'v164Result']
  ];
  function storageOK(){try{const k='__broadEtfSelfTest';localStorage.setItem(k,'ok');const ok=localStorage.getItem(k)==='ok';localStorage.removeItem(k);return ok}catch{return false}}
  function runChecks(){
    const results=checks.map(([name,b,o])=>{const button=document.getElementById(b),output=document.getElementById(o);if(!button)return{name,status:'FAIL',detail:`Missing control #${b}`};if(!output)return{name,status:'FAIL',detail:`Missing output #${o}`};if(button.disabled)return{name,status:'WARNING',detail:'Control is currently disabled'};return{name,status:'PASS',detail:'Control and output target present'}});
    ['decision','review','market','portfolio','research'].forEach(id=>results.push({name:`Navigation → ${id}`,status:document.getElementById(id)?'PASS':'FAIL',detail:document.getElementById(id)?'Anchor target present':`Missing #${id}`}));
    const sok=storageOK(); results.push({name:'Browser storage',status:sok?'PASS':'FAIL',detail:sok?'localStorage read/write available':'localStorage unavailable or blocked'});
    const hc=document.querySelectorAll('.holding').length; results.push({name:'Core ETF inputs',status:hc>=3?'PASS':'FAIL',detail:`${hc} holding inputs found`});
    results.push({name:'Application runtime',status:typeof window.fetch==='function'?'PASS':'FAIL',detail:typeof window.fetch==='function'?'Browser runtime available':'window.fetch unavailable'});
    const pass=results.filter(x=>x.status==='PASS').length,warn=results.filter(x=>x.status==='WARNING').length,failed=results.filter(x=>x.status==='FAIL'),fail=failed.length;
    const badge=document.getElementById('systemCheckBadge'),summary=document.getElementById('systemCheckSummary'),table=document.getElementById('systemCheckResults'),failBox=document.getElementById('systemCheckFailures');
    if(badge)badge.textContent=fail?'FAIL':warn?'WARNING':'PASS';
    if(summary)summary.innerHTML=`<span><b>${pass} PASS</b></span><span>${warn} WARNING</span><span><b>${fail} FAIL</b></span><span>Checked ${new Date().toLocaleString()}</span>`;
    if(failBox)failBox.innerHTML=fail?`<div style="border:2px solid currentColor;padding:12px;border-radius:10px;margin:10px 0"><b>FAILED CHECK${fail>1?'S':''}</b>${failed.map(r=>`<div style="margin-top:6px"><b>${r.name}</b> — ${r.detail}</div>`).join('')}</div>`:`<div style="margin:10px 0"><b>No failed checks.</b></div>`;
    if(table)table.innerHTML=`<table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${results.sort((a,b)=>({FAIL:0,WARNING:1,PASS:2}[a.status]-({FAIL:0,WARNING:1,PASS:2}[b.status])).map(r=>`<tr><td>${r.name}</td><td><b>${r.status}</b></td><td>${r.detail}</td></tr>`).join('')}</tbody></table>`;
  }
  function install(){const main=document.querySelector('main');if(!main)return;let card=document.getElementById('systemCheckCard');if(card)card.remove();card=document.createElement('section');card.id='systemCheckCard';card.className='card';card.innerHTML=`<div class="sectionhead"><div><p class="eyebrow">SYSTEM CHECK</p><h3>Browser control & dependency health</h3></div><span id="systemCheckBadge" class="badge">NOT RUN</span></div><p class="muted">Checks the deployed browser for expected controls, output targets, navigation anchors, storage and core UI dependencies. Failed checks are shown first and highlighted separately.</p><button id="runSystemCheck">Run system check</button><div id="systemCheckSummary" class="why"></div><div id="systemCheckFailures"></div><div id="systemCheckResults" class="tablewrap"></div>`;const first=main.firstElementChild;first?main.insertBefore(card,first.nextSibling):main.appendChild(card);document.getElementById('runSystemCheck').addEventListener('click',runChecks)}
  document.addEventListener('DOMContentLoaded',install);
})();