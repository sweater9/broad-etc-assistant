const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('decision readiness reads the actual holdings controls', async ({ page }) => {
  const holdings = page.locator('.holding');
  await holdings.nth(0).fill('6500');
  await holdings.nth(1).fill('2000');
  await holdings.nth(2).fill('1500');
  await expect(page.locator('#guardrails')).toContainText('Allocation');
  await expect(page.locator('#guardrails')).toContainText('65.0% versus 65% target');
  await expect(page.locator('#guardrails')).not.toContainText('Needs input');
});

test('monthly review drift and saved snapshot use visible portfolio values', async ({ page }) => {
  const holdings = page.locator('.holding');
  await holdings.nth(0).fill('6500');
  await holdings.nth(1).fill('2000');
  await holdings.nth(2).fill('1500');

  await expect(page.locator('#monthlyDrift')).toContainText('CSPX: 65.0%');
  await expect(page.locator('#monthlyDrift')).toContainText('EIMI: 20.0%');
  await expect(page.locator('#monthlyDrift')).toContainText('WSML: 15.0%');

  await page.locator('#run').click();
  await page.locator('#saveMonthlyReview').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('etfMonthlyReviewsV11') || '[]')[0]);
  expect(saved.holdings).toEqual({ CSPX: 6500, EIMI: 2000, WSML: 1500 });
});
