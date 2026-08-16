// V16.4 — resilient daily-data intake workflow
(() => {
  const CORE = {
    CSPX:{isin:'IE00B5BMR087',mic:'XLON'},
    EIMI:{isin:'IE00BKM4GZ66',mic:'XLON'},
    WSML:{isin:'IE00BF4RFH31',mic:'XLON'}
  };
  const parse = text => text.split(/\r?\n|,|;|\t/).map(x=>x.trim()).filter(Boolean).map(Number).filter(x=>Number.isFinite(x)&&x>0);
  function install(){
    const host=document.getElementById('dailyIntel'); if(!host||document.getElementById('v164Intake')) return;
    const box=document.createElement('div'); box.id='v164Intake'; box.className='why';
    box.innerHTML=`<b>V16.4 resilient intake:</b> Official LSE remains the preferred identity/current-market reference. If automatic chart extraction is browser-restricted, you can load a verified daily-close series without changing the recommendation logic.<div class="signalcalc" style="margin-top:10px"><select id="v164Ticker">${Object.keys(CORE).map(t=>`<option>${t}</option>`).join('')}</select><textarea id="v164Prices" rows="4" placeholder="Paste ≥200 daily closes, oldest → newest. Comma, semicolon, tab or line separated."></textarea><button id="v164Load">Validate & load history</button></div><div id="v164Result" class="muted"></div>`;
    host.appendChild(box);
    document.getElementById('v164Load').onclick=()=>{
      const ticker=document.getElementById('v164Ticker').value, vals=parse(document.getElementById('v164Prices').value), out=document.getElementById('v164Result');
      if(vals.length<200){out.textContent=`Rejected: ${vals.length} valid closes. At least 200 are required.`;return;}
      const rows=vals.map((close,i)=>({date:null,close}));
      localStorage.setItem(`priceHistory_${ticker}`,JSON.stringify({ticker,...CORE[ticker],source:'verified-manual-daily-series',loadedAt:new Date().toISOString(),rows}));
      out.textContent=`Loaded ${vals.length} validated closes for ${ticker}. Refresh market signals to recalculate momentum, trend, drawdown and volatility.`;
      window.dispatchEvent(new Event('storage'));
    };
  }
  document.addEventListener('DOMContentLoaded',install);
})();
