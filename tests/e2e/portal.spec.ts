import { ask, expect, fresh, test } from './fixtures';

test.describe('portal', () => {
  test('dashboard renders charts and filters', async ({ page }) => {
    await fresh(page);
    await expect(page.locator('h1').first()).toHaveText(/^Good afternoon, Sanne/);
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThan(5);
    await page.getByRole('tab', { name: 'Day' }).first().click();
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThanOrEqual(30);
  });

  test('notifications, profile menu and account edit', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: /Notifications/ }).click();
    // The inbox comes from the server, newest first; open the night-time alert specifically.
    await page.locator('.pop-item', { hasText: 'Unusual night-time consumption' }).click();
    await expect(page).toHaveURL(/\/insights/);
    await page.getByRole('button', { name: 'Profile menu' }).click();
    await page.locator('.popover.narrow').getByRole('button', { name: 'My account' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.getByRole('button', { name: /Edit/ }).click();
    await page.locator('input[type=tel]').fill('+31 6 1111 2222');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('+31 6 1111 2222')).toBeVisible();
  });

  test('language and theme persist across reloads', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await page.getByRole('button', { name: 'NL', exact: true }).click();
    await page.reload();
    await expect(page.locator('h1').first()).toHaveText(/^Goedemiddag/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(10, 21, 36)');
  });

  test('energy: hour view, breakdown and table', async ({ page }) => {
    await fresh(page, '/energy');
    await page.getByRole('tab', { name: 'Hour' }).click();
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThanOrEqual(24);
    await expect(page.locator('.recharts-pie-sector')).toHaveCount(8);
    await page.getByRole('button', { name: 'Show monthly table' }).click();
    await expect(page.locator('table.table tbody tr')).toHaveCount(12);
  });

  test('billing: installment modal, invoice download, filters', async ({ page }) => {
    await fresh(page, '/billing?adjust=1');
    await expect(page.locator('.modal')).toBeVisible();
    await page.locator('.modal input[type=range]').fill('210');
    await expect(page.locator('.modal')).toContainText('Pay €56');
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(page.locator('.toast')).toContainText('210');
    await expect(page).toHaveURL(/\/billing$/);
    await page.getByRole('button', { name: /^View / }).first().click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.modal').getByRole('button', { name: /Download/ }).click()]);
    expect(dl.suggestedFilename()).toMatch(/-DEMO\.html$/);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Annual' }).click();
    await expect(page.locator('#invoices tbody tr')).toHaveCount(1);
  });

  test('insights: savings plan', async ({ page }) => {
    await fresh(page, '/insights');
    const before = await page.locator('.list-row').count();
    await page.getByRole('button', { name: /Add to plan/ }).first().click();
    await expect.poll(() => page.locator('.list-row').count()).toBeGreaterThan(before);
  });

  test('smart energy: live power and 15-minute charging plan', async ({ page }) => {
    await fresh(page, '/smart-energy');
    const live = page.locator('.card-head .num').first();
    const first = await live.innerText();
    await expect.poll(() => live.innerText(), { timeout: 6000 }).not.toBe(first);
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(52); // 18:00 → 07:00 in 15-min blocks
    await expect(page.locator('p', { hasText: /^Charges/ })).toContainText('–');
    await page.getByRole('switch', { name: 'Smart charging' }).click();
    await expect(page.locator('.toast')).toContainText('scheduled');
  });
});

test.describe('assistant', () => {
  test('answers every suggestion, follows up, navigates and keeps history', async ({ page }) => {
    await fresh(page);
    await page.locator('.chat-fab').click();
    const suggestions = await page.locator('.chat-suggest button').allInnerTexts();
    expect(suggestions).toHaveLength(6);
    for (const q of suggestions) {
      const reply = await ask(page, q);
      await expect(reply).not.toContainText('not sure I understood');
    }
    // The car intent must not catch "automatische incasso".
    await expect(await ask(page, 'When is my automatic direct debit collected?')).toContainText('28');
    // Follow-up keeps the topic and uses the date.
    await ask(page, 'How much energy did I consume this month?');
    const followUp = await ask(page, 'and last month?');
    await expect(followUp).toContainText('October 2026');
    // Per-answer follow-up chips.
    await expect(page.locator('.chat-chips button').first()).toBeVisible();

    await page.locator('.chat-action', { hasText: 'Open consumption' }).last().click();
    await expect(page).toHaveURL(/\/energy$/);
    await page.getByRole('button', { name: 'Open full screen' }).click();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(page.locator('.chat-page .msg.user')).toHaveCount(suggestions.length + 3);
  });
});

test.describe('presenter mode', () => {
  test('Shift+P shows the bar; N steps through the script; R resets', async ({ page }) => {
    await fresh(page);
    await page.keyboard.press('Shift+P');
    await expect(page.locator('.presenter')).toContainText('1/6');
    await page.keyboard.press('n');
    await expect(page).toHaveURL(/\/energy$/);
    await page.keyboard.press('n');
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.locator('.modal')).toBeVisible();
    await page.keyboard.press('Escape'); // closes the modal, not the bar
    await expect(page.locator('.presenter')).toBeVisible();
    await page.keyboard.press('4');
    await expect(page.locator('.chat-widget')).toBeVisible();
    await expect(page.locator('.chat-widget .msg.bot .bubble').last()).toContainText('12% higher', { timeout: 6000 });
    await page.locator('body').click({ position: { x: 600, y: 120 } });
    await page.keyboard.press('r');
    await expect(page.locator('.presenter')).toContainText('1/6');
    await expect(page).toHaveURL(/\/$/);
    await page.reload();
    await expect(page.locator('.presenter')).toBeVisible(); // remembered
  });
});

test('the website widget demo is gone', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('.sidebar')).not.toContainText('Website widget');
  // Old links land on the portal home instead of a dead page.
  await page.goto('/website-demo');
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get('/start')).ok()).toBe(true);
  await page.goto('/start');
  await expect(page.locator('a[href="/website-demo"]')).toHaveCount(0);
});

test('mobile preview shows the phone and a QR code', async ({ page }) => {
  await fresh(page, '/mobile-preview');
  await expect(page.locator('.phone iframe')).toBeVisible();
  await expect(page.locator('.phone-qr-code svg')).toBeVisible();
  await expect(page.locator('.phone-qr-url')).toContainText('http');
});
