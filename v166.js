// V16.6 — Recommendation Engine Validation
(()=>{
 const CORE=['CSPX','EIMI','WSML'];
 const finite=x=>Number.isFinite(x);
 function hist(t){try{const raw=localStorage.getItem('priceHistory_'+t)||localStorage.getItem('marketHistory_'+t)||localStorage.getItem('prices_'+t);const v=JSON.parse(raw||'[]');const a=Array.isArray(v)?v:(Array.isArray(v.rows)?v.rows:[]);return a.map(x=>typeof x==='number'?x:Number(x?.close??x?.price??x?.value)).filter(x=>finite(x)&&x>0)}catch{return[]}}
 function validate(){
   const issues=[], rows=CORE.map(t=>{const p=hist(t), n=p.length, last=p.at(-1), bad=p.some(x=>!finite(x)||x<=0), jumps=p.slice(1).filter((x,i)=>Math.abs(x/p[i]-1)>.35).length;let status='PASS',detail=`${n} valid closes`;
     if(n<200){status='FAIL';detail=`Only ${n} closes; ≥200 required for recommendation-grade signals`;issues.push(`${t}: insufficient history`)}
     else if(bad){status='FAIL';detail='Invalid/non-positive prices detected';issues.push(`${t}: invalid prices`)}
     else if(jumps>2){status='WARNING';detail=`${jumps} daily moves >35% detected; verify split/currency/data continuity`;issues.push(`${t}: unusual price jumps`)}
     return{t,n,last,status,detail};});
   const ready=rows.every(r=>r.status==='PASS');
   return{ready,rows,issues};
 }
 function render(){
   const host=document.getElementById('engineValidation');if(!host)return;
   const v=validate(), badge=document.getElementById('engineValidationBadge');
   if(badge)badge.textContent=v.ready?'VALIDATED':v.rows.some(r=>r.status==='FAIL')?'BLOCKED':'REVIEW';
   host.innerHTML=`<div class="tablewrap"><table><thead><tr><th>ETF</th><th>History</th><th>Status</th><th>Validation</th></tr></thead><tbody>${v.rows.map(r=>`<tr><td><b>${r.t}</b></td><td>${r.n}</td><td><b>${r.status}</b></td><td>${r.detail}</td></tr>`).join('')}</tbody></table></div><div class="why"><span><b>Recommendation gate:</b> ${v.ready?'OPEN — all three core ETFs have recommendation-grade history.':'CLOSED — market-data-driven recommendations must not be treated as high confidence yet.'}</span><span>Portfolio drift and target-allocation calculations can still be used independently of market timing signals.</span></div>`;
   const readiness=document.getElementById('guardrails');if(readiness){const marker=document.getElementById('v166Guard');if(marker)marker.remove();const d=document.createElement('div');d.id='v166Guard';d.className='why';d.innerHTML=`<span><b>V16.6 engine validation:</b> ${v.ready?'PASS — recommendation data gate open.':'BLOCKED — insufficient/uncertain daily history. Do not rely on a high-confidence market-timing recommendation.'}</span>`;readiness.prepend(d)}
 }
 function install(){
   if(document.getElementById('engineValidationCard')){render();return}
   const market=document.getElementById('market');if(!market)return;
   const card=document.createElement('section');card.id='engineValidationCard';card.className='card';card.innerHTML=`<div class="sectionhead"><div><p class="eyebrow">RECOMMENDATION ENGINE VALIDATION</p><h3>Can the market signals safely influence this month's allocation?</h3></div><span id="engineValidationBadge" class="badge">CHECKING</span></div><div id="engineValidation"></div>`;
   market.insertAdjacentElement('afterend',card);render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
 window.addEventListener('storage',render);
 window.BroadEtfValidation={validate,render};
})();