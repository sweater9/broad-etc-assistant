const ETFs=[
 {t:'CSPX',name:'S&P 500',target:65,val:48,trend:78,risk:70,macro:72},
 {t:'EIMI',name:'Emerging Markets IMI',target:20,val:78,trend:68,risk:58,macro:66},
 {t:'WSML',name:'World Small Cap',target:15,val:72,trend:64,risk:55,macro:64},
 {t:'SSAC',name:'MSCI ACWI',target:0,val:61,trend:73,risk:68,macro:70},
 {t:'VWRA',name:'FTSE All-World',target:0,val:61,trend:73,risk:68,macro:70}
];
const $=s=>document.querySelector(s); const holdings=$('#holdings');
ETFs.forEach(e=>{holdings.insertAdjacentHTML('beforeend',`<div class='holdingrow'><label>${e.t} — ${e.name}</label><input class='holding' data-t='${e.t}' type='number' min='0' value='0'></div>`)});
function signal(s){return s>=80?['Strong Buy','buy']:s>=65?['Buy','buy']:s>=50?['Buy gradually','hold']:s>=35?['Wait','wait']:['Avoid adding','wait']}
function run(){const budget=+$('input#budget').value||0;let total=0;let vals={};document.querySelectorAll('.holding').forEach(x=>{vals[x.dataset.t]=+x.value||0;total+=+x.value||0});
 let scored=ETFs.map(e=>{let current=total?100*vals[e.t]/total:0;let need=e.target?Math.max(0,Math.min(100,50+(e.target-current)*3)):25;let s=Math.round(.30*e.val+.25*e.trend+.20*need+.15*e.risk+.10*e.macro);return {...e,current,need,s}});
 let eligible=scored.filter(e=>e.target>0);eligible.sort((a,b)=>b.s-a.s);let best=eligible[0],sig=signal(best.s);$('#pick').textContent=`AED ${budget.toLocaleString()} → ${best.t}`;$('#score').textContent=best.s;$('#reason').textContent=`${sig[0]}. ${best.name} ranks highest after valuation, trend, risk and how far your portfolio is from its target allocation.`;
 $('#rows').innerHTML=scored.map(e=>{let q=signal(e.s);return `<tr><td><b>${e.t}</b></td><td>${e.name}</td><td>${e.target?e.target+'%':'Alternative'}</td><td>${e.current.toFixed(1)}%</td><td>${e.val}/100</td><td>${e.trend}/100</td><td>${e.risk}/100</td><td><b>${e.s}</b></td><td class='signal ${q[1]}'>${q[0]}</td></tr>`}).join('');
 let d=new Date().toLocaleString();let h=$('#history');if(h.classList.contains('muted')){h.classList.remove('muted');h.innerHTML=''}h.insertAdjacentHTML('afterbegin',`<p><b>${d}</b> — AED ${budget.toLocaleString()} → <b>${best.t}</b> (${best.s}/100)</p>`)}
$('#run').onclick=run;$('#reset').onclick=()=>{document.querySelectorAll('.holding').forEach(x=>x.value=0);run()};run();