const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('core page and navigation render', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('ETF Investment Assistant');
  for (const id of ['decision','review','market','portfolio','research']) await expect(page.locator('#'+id)).toBeAttached();
});

test('system check runs without structural failures', async ({ page }) => {
  await page.locator('#runSystemCheck').click();
  await expect(page.locator('#systemCheckSummary')).toContainText('PASS');
  await expect(page.locator('#systemCheckFailures')).toContainText('No failed checks');
});

test('monthly decision responds to budget', async ({ page }) => {
  await page.locator('#budget').fill('700');
  await page.locator('#run').click();
  await expect(page.locator('#pick')).not.toHaveText('—');
  await expect(page.locator('#postAllocation')).not.toBeEmpty();
});

test('portfolio save and clear work', async ({ page }) => {
  const holdings=page.locator('.holding');
  await expect(holdings).toHaveCount(3);
  await holdings.nth(0).fill('1000'); await holdings.nth(1).fill('200'); await holdings.nth(2).fill('100');
  await page.locator('#save').click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('broadEtfV8'))).not.toBeNull();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('broadEtfV8')));
  expect(saved.CSPX).toBe(1000); expect(saved.EIMI).toBe(200); expect(saved.WSML).toBe(100);
  await page.locator('#reset').click();
  await expect(holdings.nth(0)).toHaveValue('0');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('broadEtfV8'))).toBeNull();
});

test('research tools produce output', async ({ page }) => {
  for (const [button,out] of [['#runBacktest','#backtestSummary'],['#runProjection','#projectionSummary'],['#runStress','#stressSummary']]) {
    await page.locator(button).click(); await expect(page.locator(out)).not.toBeEmpty();
  }
});

test('ETF comparison works', async ({ page }) => {
  await page.locator('#compareBtn').click();
  await expect(page.locator('#compareResult')).not.toBeEmpty();
});

test('daily history rejects insufficient observations', async ({ page }) => {
  await page.locator('#v164Prices').fill('100,101,102');
  await page.locator('#v164Load').click();
  await expect(page.locator('#v164Result')).toContainText('Rejected');
});

test('allocation audit conserves AED 700 contribution', async ({ page }) => {
  await page.locator('#budget').fill('700');
  await expect(page.locator('#allocationAudit')).toContainText('Allocated AED 700.00 of AED 700.00');
});

test('validated same-origin market cache populates all core histories', async ({ page }) => {
  const start=new Date(); start.setUTCDate(start.getUTCDate()-259);
  const rows=Array.from({length:260},(_,i)=>{const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);return{d:d.toISOString().slice(0,10),p:100+i*0.1}});
  const latest=rows.at(-1).d;
  const payload={schemaVersion:1,generatedAt:new Date().toISOString(),source:'QA validated cache',symbols:{
    CSPX:{ticker:'CSPX',symbol:'CSPX.L',latestDate:latest,rows},
    EIMI:{ticker:'EIMI',symbol:'EIMI.L',latestDate:latest,rows:rows.map(x=>({...x,p:x.p*0.5}))},
    WSML:{ticker:'WSML',symbol:'WSML.L',latestDate:latest,rows:rows.map(x=>({...x,p:x.p*0.02}))}
  }};
  await page.route('**/data/market-history.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)}));
  await expect.poll(()=>page.evaluate(()=>!!window.BroadEtfMarketCache)).toBeTruthy();
  await page.locator('#refreshMarket').click();
  await expect(page.locator('#feedStatus')).toContainText(/FRESH CACHE|CACHED/);
  await expect(page.locator('#refreshResult')).toContainText('QA validated cache');
  for(const ticker of ['CSPX','EIMI','WSML']){
    const n=await page.evaluate(t=>JSON.parse(localStorage.getItem('broadEtfHistories')||'{}')[t]?.length||0,ticker);
    expect(n).toBe(260);
  }
});

test('cache failure preserves validated local history instead of deleting it', async ({ page }) => {
  const rows=Array.from({length:220},(_,i)=>({d:String(i).padStart(5,'0'),p:100+i}));
  await page.evaluate(rows=>localStorage.setItem('broadEtfHistories',JSON.stringify({CSPX:rows,EIMI:rows,WSML:rows})),rows);
  await page.route('**/data/market-history.json*',route=>route.fulfill({status:503,body:'offline'}));
  await expect.poll(()=>page.evaluate(()=>!!window.BroadEtfMarketCache)).toBeTruthy();
  await page.locator('#refreshMarket').click();
  await expect(page.locator('#feedStatus')).toHaveText('CACHED LOCAL');
  await expect(page.locator('#refreshResult')).toContainText('Retaining previously validated local history');
  const counts=await page.evaluate(()=>Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem('broadEtfHistories'))).map(([k,v])=>[k,v.length])));
  expect(counts).toEqual({CSPX:220,EIMI:220,WSML:220});
});

test('primary interactive controls complete without browser errors', async ({ page }) => {
  const pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(err.message));
  const start=new Date(); start.setUTCDate(start.getUTCDate()-259);
  const rows=Array.from({length:260},(_,i)=>{const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);return{d:d.toISOString().slice(0,10),p:100+i*0.1}});
  const latest=rows.at(-1).d;
  const payload={schemaVersion:1,generatedAt:new Date().toISOString(),source:'QA control-smoke cache',symbols:{
    CSPX:{ticker:'CSPX',symbol:'CSPX.L',latestDate:latest,rows},
    EIMI:{ticker:'EIMI',symbol:'EIMI.L',latestDate:latest,rows:rows.map(x=>({...x,p:x.p*0.5}))},
    WSML:{ticker:'WSML',symbol:'WSML.L',latestDate:latest,rows:rows.map(x=>({...x,p:x.p*0.02}))}
  }};
  await page.route('**/data/market-history.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)}));

  await page.locator('#runSystemCheck').click();
  await expect(page.locator('#systemCheckSummary')).toContainText('PASS');
  await page.locator('#refreshMarket').click();
  await expect(page.locator('#feedStatus')).toContainText(/FRESH CACHE|CACHED/);

  const holdings=page.locator('.holding');
  await holdings.nth(0).fill('6500'); await holdings.nth(1).fill('2000'); await holdings.nth(2).fill('1500');
  await page.locator('#save').click();
  await page.locator('#run').click();
  await expect(page.locator('#postAllocation')).not.toBeEmpty();

  await page.locator('#runProjection').click();
  await page.locator('#runStress').click();
  await page.locator('#runBacktest').click();
  await expect(page.locator('#projectionSummary')).not.toBeEmpty();
  await expect(page.locator('#stressSummary')).not.toBeEmpty();
  await expect(page.locator('#backtestSummary')).not.toBeEmpty();

  await page.locator('#compareBtn').click();
  await expect(page.locator('#compareResult')).not.toBeEmpty();
  await page.locator('#applyReference').click();

  await page.locator('#priceHistory').fill(Array.from({length:30},(_,i)=>String(100+i)).join(','));
  await page.locator('#calcSignal').click();
  await expect(page.locator('#calcResult')).toContainText('Trend');

  await page.locator('#ibkrJson').fill(JSON.stringify({positions:[{symbol:'CSPX',marketValue:1000},{symbol:'EIMI',marketValue:500},{symbol:'WSML',marketValue:250}]}));
  await page.locator('#importIbkr').click();
  await expect(page.locator('#ibkrResult')).toContainText('Imported 3');

  await page.locator('#saveMonthlyReview').click();
  await expect(page.locator('#reviewStatus')).toContainText('Saved');
  await page.locator('#clearMonthlyReviews').click();
  await expect(page.locator('#reviewStatus')).toContainText('cleared');

  for(const id of ['#clearOutcomes','#clearAudit']){
    const control=page.locator(id);
    if(await control.count()) await control.click();
  }

  await page.locator('#reset').click();
  await expect(holdings.nth(0)).toHaveValue('0');
  expect(pageErrors).toEqual([]);
});

test('how-to-use page is reachable', async ({ page }) => {
  await page.goto('/how-to-use.html');
  await expect(page.locator('body')).toContainText(/How to|ETF/i);
});
