// V16.5.5 — resilient daily-data intake workflow with reliable initialization
(() => {
  const CORE={CSPX:{isin:'IE00B5BMR087',mic:'XLON'},EIMI:{isin:'IE00BKM4GZ66',mic:'XLON'},WSML:{isin:'IE00BF4RFH31',mic:'XLON'}};
  const parse=text=>text.split(/\r?\n|,|;|\t/).map(x=>x.trim()).filter(Boolean).map(Number).filter(x=>Number.isFinite(x)&&x>0);
  function install(){
    const host=document.getElementById('dailyIntel');
    if(!host||document.getElementById('v164Intake')) return false;
    const box=document.createElement('div');box.id='v164Intake';box.className='why';
    box.innerHTML=`<b>Daily-history intake:</b> If automatic market-history extraction is unavailable, load a verified daily-close series here. The recommendation engine requires at least 200 valid closes.<div class="signalcalc" style="margin-top:10px"><select id="v164Ticker">${Object.keys(CORE).map(t=>`<option>${t}</option>`).join('')}</select><textarea id="v164Prices" rows="4" placeholder="Paste ≥200 daily closes, oldest → newest. Comma, semicolon, tab or line separated."></textarea><button id="v164Load" type="button">Validate & load history</button></div><div id="v164Result" class="muted"></div>`;
    host.appendChild(box);
    const load=document.getElementById('v164Load');
    load.onclick=()=>{const ticker=document.getElementById('v164Ticker').value,vals=parse(document.getElementById('v164Prices').value),out=document.getElementById('v164Result');if(vals.length<200){out.textContent=`Rejected: ${vals.length} valid closes. At least 200 are required.`;return;}const rows=vals.map(close=>({date:null,close}));try{localStorage.setItem(`priceHistory_${ticker}`,JSON.stringify({ticker,...CORE[ticker],source:'verified-manual-daily-series',loadedAt:new Date().toISOString(),rows}));out.textContent=`Loaded ${vals.length} validated closes for ${ticker}. Refresh market signals to recalculate momentum, trend, drawdown and volatility.`;window.dispatchEvent(new Event('storage'));}catch(e){out.textContent=`Could not save history: ${e.message||e}`;}};
    return true;
  }
  function boot(){if(install())return;let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>=20)clearInterval(timer)},100);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.installDailyHistoryIntake=install;
})();