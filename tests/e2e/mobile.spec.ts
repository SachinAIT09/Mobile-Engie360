import { ask, expect, fresh, noHorizontalScroll, test } from './fixtures';

const ROUTES = ['/', '/energy', '/billing', '/insights', '/smart-energy', '/assistant', '/account'];

test('no horizontal scrolling on any screen at 390 px', async ({ page }) => {
  await fresh(page);
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForTimeout(500);
    expect(await noHorizontalScroll(page), r).toBe(true);
  }
});

test('tab bar, drawer and full-screen assistant', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('.tabbar')).toBeVisible();
  await page.locator('.tabbar a', { hasText: 'Bills' }).click();
  await expect(page).toHaveURL(/\/billing$/);
  await page.locator('.tabbar button', { hasText: 'More' }).click();
  await expect(page.locator('.sidebar.open')).toBeVisible();
  await page.locator('.sidebar a', { hasText: 'Smart Energy' }).click();
  await expect(page).toHaveURL(/\/smart-energy$/);
  await page.locator('.chat-fab').click();
  await expect(page.locator('.chat-widget')).toBeVisible();
  const box = await page.locator('.chat-widget').boundingBox();
  expect(box?.width).toBe(390);
  await ask(page, 'When should I charge my EV?');
});
