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
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('etfHoldings'))).not.toBeNull();
  await page.locator('#reset').click();
  await expect(holdings.nth(0)).toHaveValue('0');
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

test('how-to-use page is reachable', async ({ page }) => {
  await page.goto('/how-to-use.html');
  await expect(page.locator('body')).toContainText(/How to|ETF/i);
});
