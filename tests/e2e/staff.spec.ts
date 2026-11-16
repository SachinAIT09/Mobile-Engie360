import { expect, fresh, test } from './fixtures';

test.describe('staff app: pages like the Hydro Mobile360 staff app', () => {
  test('dashboard, then every page from the rail', async ({ page }) => {
    await fresh(page, '/staff');
    await expect(page.locator('.staff-conn')).toHaveClass(/live/, { timeout: 10_000 });
    await expect(page.locator('h1')).toHaveText('Dashboard');
    await expect(page.locator('.staff-kpis .kpi')).toHaveCount(5);
    const pages: [string, RegExp, string][] = [
      ['Customer activity', /\/staff\/activity$/, 'Customer activity'],
      ['Eva conversations', /\/staff\/conversations$/, 'Eva conversations'],
      ['Messages', /\/staff\/messages$/, 'Messages'],
      ['Demo control panel', /\/staff\/demo$/, 'Demo control panel'],
      ['Phone preview', /\/staff\/preview$/, 'Phone preview'],
    ];
    for (const [link, url, title] of pages) {
      const railLink = page.locator('.rs-rail').getByRole('link', { name: link, exact: true });
      await railLink.click();
      await expect(page).toHaveURL(url);
      await expect(page.locator('h1')).toHaveText(title);
      await expect(railLink).toHaveClass(/active/);
    }
    await expect(page.getByRole('link', { name: 'Open MijnENGIE' })).toHaveAttribute('href', '/app');
    await expect(page.getByRole('link', { name: 'Start page' })).toHaveAttribute('href', '/');
  });

  test('the rail widens on hover', async ({ page }) => {
    await fresh(page, '/staff');
    const slot = page.locator('.rs-slot');
    const narrow = (await slot.boundingBox())!.width;
    await slot.hover({ position: { x: 30, y: 200 } });
    await expect.poll(async () => (await slot.boundingBox())!.width).toBeGreaterThan(narrow + 100);
  });

  test('activity filters', async ({ page }) => {
    await fresh(page, '/staff/activity');
    await page.request.post('/api/installment', { data: { amount: 200 } });
    await page.request.post('/api/insights/plan', { data: { id: 'baseload', on: true } });
    await expect(page.locator('.staff-table tbody tr')).toHaveCount(2);
    await page.locator('.pills').getByRole('button', { name: 'Billing' }).click();
    await expect(page.locator('.staff-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.staff-table')).toContainText('Changed installment to €200');
    await page.locator('.pills').getByRole('button', { name: 'Views' }).click();
    await expect(page.locator('.staff-details')).toHaveCount(0);
  });

  test('theme menu: Match system follows the device', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await fresh(page, '/staff');
    await page.getByRole('button', { name: /^Theme/ }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('menuitemradio', { name: 'Match system' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Theme: Match system' })).toBeVisible();
  });

  test('presenter bar: Shift+P, steps through the staff pages, R resets', async ({ page }) => {
    await fresh(page, '/staff');
    await expect(page.locator('h1')).toHaveText('Dashboard'); // app loaded, keyboard listener attached
    await page.keyboard.press('Shift+P');
    await expect(page.locator('.presenter')).toContainText('1/6');
    await page.keyboard.press('n');
    await expect(page).toHaveURL(/\/staff\/activity$/);
    await page.keyboard.press('4');
    await expect(page).toHaveURL(/\/staff\/demo$/);
    await expect(page.locator('.presenter')).toContainText('4/6');
    await page.keyboard.press('r');
    await expect(page.locator('.presenter')).toContainText('1/6');
    await expect(page).toHaveURL(/\/staff$/);
    await page.reload();
    await expect(page.locator('.presenter')).toBeVisible(); // remembered
  });

  test('phone preview shows the signed-in app and a QR code', async ({ page }) => {
    await fresh(page, '/staff/preview');
    await expect(page.locator('.phone iframe')).toHaveAttribute('src', '/app');
    await expect(page.locator('.phone-qr-code svg')).toBeVisible();
    await expect(page.locator('.phone-qr-url')).toContainText('/app');
    const frame = page.frameLocator('.phone iframe');
    await expect(frame.locator('.app-tabs')).toBeVisible({ timeout: 10_000 });
  });
});
