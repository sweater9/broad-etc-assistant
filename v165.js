// V16.5.3 — system check: supports static HTML card and reliable button binding
(() => {
  const checks=[['Monthly decision','run','pick'],['Save portfolio','save','holdings'],['Clear portfolio','reset','holdings'],['Refresh market signals','refreshMarket','refreshResult'],['Save monthly review','saveMonthlyReview','monthlyReview'],['Clear monthly reviews','clearMonthlyReviews','monthlyReview'],['Clear outcomes','clearOutcomes','outcomeTracker'],['IBKR import','importIbkr','ibkrResult'],['Backtest','runBacktest','backtestSummary'],['Projection','runProjection','projectionSummary'],['Stress test','runStress','stressSummary'],['ETF comparison','compareBtn','compareResult'],['Manual signal calculation','calcSignal','calcResult'],['Restore issuer snapshot','applyReference','signals'],['Clear recommendation audit','clearAudit','auditTrail'],['Daily-history intake','v164Load','v164Result']];
  function storageOK(){try{const k='__broadEtfSelfTest';localStorage.setItem(k,'ok');const ok=localStorage.getItem(k)==='ok';localStorage.removeItem(k);return ok}catch(e){return false}}
  function runChecks(){
    try{
      const results=checks.map(([name,b,o])=>{const button=document.getElementById(b),output=document.getElementById(o);if(!button)return{name,status:'FAIL',detail:`Missing control #${b}`};if(!output)return{name,status:'FAIL',detail:`Missing output #${o}`};if(button.disabled)return{name,status:'WARNING',detail:'Control is currently disabled'};return{name,status:'PASS',detail:'Control and output target present'}});
      ['decision','review','market','portfolio','research'].forEach(id=>results.push({name:`Navigation → ${id}`,status:document.getElementById(id)?'PASS':'FAIL',detail:document.getElementById(id)?'Anchor target present':`Missing #${id}`}));
      const sok=storageOK();results.push({name:'Browser storage',status:sok?'PASS':'FAIL',detail:sok?'localStorage read/write available':'localStorage unavailable or blocked'});
      const hc=document.querySelectorAll('.holding').length;results.push({name:'Core ETF inputs',status:hc>=3?'PASS':'FAIL',detail:`${hc} holding inputs found`});
      results.push({name:'Application runtime',status:typeof window.fetch==='function'?'PASS':'FAIL',detail:typeof window.fetch==='function'?'Browser runtime available':'window.fetch unavailable'});
      const pass=results.filter(x=>x.status==='PASS').length,warn=results.filter(x=>x.status==='WARNING').length,failed=results.filter(x=>x.status==='FAIL'),fail=failed.length;
      const badge=document.getElementById('systemCheckBadge'),summary=document.getElementById('systemCheckSummary'),table=document.getElementById('systemCheckResults'),failBox=document.getElementById('systemCheckFailures');
      if(badge)badge.textContent=fail?'FAIL':warn?'WARNING':'PASS';
      if(summary)summary.innerHTML=`<span><b>${pass} PASS</b></span><span>${warn} WARNING</span><span><b>${fail} FAIL</b></span><span>Checked ${new Date().toLocaleString()}</span>`;
      if(failBox)failBox.innerHTML=fail?`<div style="border:2px solid currentColor;padding:12px;border-radius:10px;margin:10px 0"><b>FAILED CHECK${fail>1?'S':''}</b>${failed.map(r=>`<div style="margin-top:6px"><b>${r.name}</b> — ${r.detail}</div>`).join('')}</div>`:`<div style="margin:10px 0"><b>No failed checks.</b></div>`;
      if(table)table.innerHTML=`<table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${results.sort((a,b)=>({FAIL:0,WARNING:1,PASS:2}[a.status]-({FAIL:0,WARNING:1,PASS:2}[b.status])).map(r=>`<tr><td>${r.name}</td><td><b>${r.status}</b></td><td>${r.detail}</td></tr>`).join('')}</tbody></table>`;
    }catch(e){const f=document.getElementById('systemCheckFailures');if(f)f.innerHTML=`<div style="border:2px solid currentColor;padding:12px;border-radius:10px"><b>System Check runtime error</b><div>${String(e&&e.message||e)}</div></div>`;}
  }
  function bind(){
    const button=document.getElementById('runSystemCheck');
    if(!button)return;
    button.onclick=runChecks;
    button.dataset.systemCheckBound='true';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  window.runBroadEtfSystemCheck=runChecks;
})();