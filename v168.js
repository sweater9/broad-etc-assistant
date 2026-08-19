// V16.8 — production market-data cache and freshness/fallback handling
(()=>{
  const CORE=['CSPX','EIMI','WSML'];
  const DAY=86400000;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function ageDays(date){const t=Date.parse(date+'T00:00:00Z');return Number.isFinite(t)?Math.floor((Date.now()-t)/DAY):9999}
  function quality(x){const age=ageDays(x?.latestDate);if((x?.rows?.length||0)<200)return{state:'UNAVAILABLE',age};if(age<=3)return{state:'FRESH CACHE',age};if(age<=7)return{state:'CACHED',age};return{state:'STALE',age}}
  function syncStores(data){
    const all={};try{Object.assign(all,JSON.parse(localStorage.getItem('broadEtfHistories')||'{}'))}catch{}
    for(const t of CORE){
      const item=data.symbols?.[t];if(!item?.rows?.length)continue;
      const rows=item.rows.map(r=>({d:r.d,p:+r.p})).filter(r=>r.d&&r.p>0);
      const compat=rows.map(r=>({date:r.d,close:r.p}));
      all[t]=rows;
      localStorage.setItem('priceHistory_'+t,JSON.stringify(compat));
      localStorage.setItem('marketHistory_'+t,JSON.stringify(compat));
      if(typeof histories!=='undefined')histories[t]=rows;
      if(typeof ETFs!=='undefined'){
        const e=ETFs.find(x=>x.t===t);if(e&&typeof calcPrices==='function'){
          const m=calcPrices(rows.map(r=>r.p));e.trend=m.trend;e.risk=m.risk;e.signalAsOf=item.latestDate;
          const input=document.querySelector(`.metric[data-t='${t}'][data-k='trend']`);if(input)input.value=e.trend;
        }
      }
    }
    localStorage.setItem('broadEtfHistories',JSON.stringify(all));
    localStorage.setItem('broadEtfMarketCacheMeta',JSON.stringify({generatedAt:data.generatedAt,source:data.source,loadedAt:new Date().toISOString()}));
  }
  async function loadCache(){
    const r=await fetch(`data/market-history.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Cache HTTP ${r.status}`);
    const data=await r.json();
    if(!data?.symbols)throw new Error('Invalid cache payload');
    const missing=CORE.filter(t=>(data.symbols[t]?.rows?.length||0)<200);if(missing.length)throw new Error(`Insufficient cache: ${missing.join(', ')}`);
    return data;
  }
  async function refresh(){
    const b=document.getElementById('refreshMarket'),out=document.getElementById('refreshResult'),badge=document.getElementById('feedStatus');
    if(!b||!out||!badge)return;
    b.disabled=true;badge.textContent='REFRESHING';out.innerHTML='<span>Loading validated same-origin market cache…</span>';
    try{
      const data=await loadCache();syncStores(data);
      const states=CORE.map(t=>({t,...quality(data.symbols[t]),x:data.symbols[t]}));
      const worst=states.reduce((a,x)=>Math.max(a,x.age),0);
      badge.textContent=worst<=3?'FRESH CACHE':worst<=7?'CACHED':'STALE';
      out.innerHTML=states.map(s=>`<span><b>${s.t}</b> ${esc(s.state)} · ${s.x.rows.length} closes · latest ${esc(s.x.latestDate)} (${s.age}d old)</span>`).join('')+`<span><b>Source:</b> ${esc(data.source||'validated repository cache')} · generated ${esc((data.generatedAt||'').replace('T',' ').slice(0,19))} UTC</span>`;
      if(typeof backtestReadiness==='function')backtestReadiness();
      window.BroadEtfV16?.render?.();window.BroadEtfValidation?.render?.();window.BroadEtfAllocationAudit?.render?.();
      if(typeof run==='function')run();
    }catch(err){
      let existing={};try{existing=JSON.parse(localStorage.getItem('broadEtfHistories')||'{}')}catch{}
      const counts=CORE.map(t=>(existing[t]||[]).length),usable=counts.every(n=>n>=200);
      badge.textContent=usable?'CACHED LOCAL':'UNAVAILABLE';
      out.innerHTML=`<span><b>Automatic cache unavailable:</b> ${esc(err.message||err)}</span><span>${usable?'Retaining previously validated local history; no data was discarded.':'No recommendation-grade history is currently available. Use the validated manual history intake rather than relying on market timing.'}</span>`;
      window.BroadEtfV16?.render?.();window.BroadEtfValidation?.render?.();window.BroadEtfAllocationAudit?.render?.();
      if(typeof run==='function')run();
    }finally{b.disabled=false}
  }
  function install(){const b=document.getElementById('refreshMarket');if(!b)return;b.onclick=refresh;b.title='Loads the repository-hosted validated daily market cache; preserves last validated local history if refresh fails.'}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.BroadEtfMarketCache={refresh,loadCache,quality};
})();
