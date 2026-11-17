import { expect, fresh, test } from './fixtures';

/** The live demo customer's page (everyone else in the customer base is sample data). */
const LIVE = '/staff/customers/C-2003418762';

test.describe('staff app: pages like the Hydro Mobile360 staff app', () => {
  test('dashboard, then every page from the rail', async ({ page }) => {
    await fresh(page, '/staff');
    await expect(page.locator('.staff-conn')).toHaveClass(/live/, { timeout: 10_000 });
    await expect(page.locator('h1')).toHaveText('Dashboard');
    await expect(page.locator('.staff-kpis .kpi')).toHaveCount(5);
    const pages: [string, RegExp, string][] = [
      ['Customers', /\/staff\/customers$/, 'Customers'],
      ['Customer activity', /\/staff\/activity$/, 'Customer activity'],
      ['Eva conversations', /\/staff\/conversations$/, 'Eva conversations'],
      ['Messages', /\/staff\/messages$/, 'Messages'],
      ['Reports', /\/staff\/reports$/, 'Reports'],
      ['AI assistant', /\/staff\/assistant$/, 'AI assistant'],
      ['Demo control panel', /\/staff\/demo$/, 'Demo control panel'],
      ['Audit log', /\/staff\/audit$/, 'Audit log'],
    ];
    for (const [link, url, title] of pages) {
      const railLink = page.locator('.rs-rail').getByRole('link', { name: link, exact: true });
      await railLink.click();
      await expect(page).toHaveURL(url);
      await expect(page.locator('h1')).toHaveText(title);
      await expect(railLink).toHaveClass(/active/);
    }
    // The rail has only staff pages: no links out to the customer app or the start page.
    await expect(page.locator('.rs-rail')).not.toContainText(/Open MijnENGIE|Start page/);
  });

  test('the rail widens on hover', async ({ page }) => {
    await fresh(page, '/staff');
    const slot = page.locator('.rs-slot');
    const narrow = (await slot.boundingBox())!.width;
    await slot.hover({ position: { x: 30, y: 200 } });
    await expect.poll(async () => (await slot.boundingBox())!.width).toBeGreaterThan(narrow + 100);
  });

  test('activity across all customers, with filters', async ({ page }) => {
    await fresh(page, '/staff/activity');
    await page.request.post('/api/installment', { data: { amount: 200 } });
    await page.request.post('/api/insights/plan', { data: { id: 'baseload', on: true } });
    // The table covers the whole customer base; these two rows are the live customer's.
    const mine = page.locator('.staff-table tbody tr', { hasText: 'Olivia Carter' });
    await expect(mine).toHaveCount(2);
    expect(await page.locator('.staff-table tbody tr').count()).toBeGreaterThan(20);
    await page.locator('.pills').getByRole('button', { name: 'Billing' }).click();
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText('Changed installment to €200');
    await mine.getByRole('link', { name: 'Olivia Carter' }).click();
    await expect(page).toHaveURL(/\/staff\/customers\/C-2003418762$/);
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
    await expect(page.locator('.presenter')).toContainText('1/5');
    await page.keyboard.press('n');
    await expect(page).toHaveURL(/\/staff\/activity$/);
    await page.keyboard.press('4');
    await expect(page).toHaveURL(/\/staff\/demo$/);
    await expect(page.locator('.presenter')).toContainText('4/5');
    await page.keyboard.press('r');
    await expect(page.locator('.presenter')).toContainText('1/5');
    await expect(page).toHaveURL(/\/staff$/);
    await page.reload();
    await expect(page.locator('.presenter')).toBeVisible(); // remembered
  });

  test('dashboard for the whole customer base: numbers, attention queue, live feed', async ({ page }) => {
    await fresh(page, '/staff');
    await expect(page.locator('.staff-kpis .kpi').first()).toContainText('1,248');
    await expect(page.locator('.attention-row')).toHaveCount(3);
    const queue = page.locator('.attention-row', { hasText: 'Installment too low' });
    const count = Number((await queue.locator('.queue-count').innerText()).replace(/\D/g, ''));
    expect(count).toBeGreaterThan(100);
    // The feed names the customer, says what they did, and is alive.
    await expect(page.locator('.feed li')).toHaveCount(6);
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThan(2);
    await page.request.post('/api/installment', { data: { amount: 198 } });
    const mine = page.locator('.feed li', { hasText: 'Olivia Carter' });
    await expect(mine).toContainText('Changed installment to €198');
    // The live customer raised it, so one customer fewer needs that advice.
    await expect(queue.locator('.queue-count')).toHaveText(new Intl.NumberFormat('en-GB').format(count - 1));
    // One message to everyone it applies to.
    await queue.getByRole('link', { name: /^Message / }).click();
    await expect(page).toHaveURL(/\/staff\/messages\?segment=installment&template=installment$/);
    await expect(page.locator('.composer-to')).toContainText(`${count - 1} customers · Installment too low`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Advice: raise your installment to €198');
    await page.getByRole('button', { name: /^Send$/ }).click();
    await expect(page.locator('.toast').last()).toContainText(`Sent to ${count - 1} customers`);
    await expect(page.locator('.outbox li').first()).toContainText(`To ${count - 1} customers`);
    await expect(page.locator('.outbox li').first()).toContainText(`of ${count - 1} read`);
    // It did not go to the live customer, who no longer needs it.
    expect(await (await page.request.get('/api/messages')).json()).toHaveLength(4);
    await page.locator('.rs-rail').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(queue).toContainText('already sent the message');
  });

  test('customer list: search, filter, paging, open a customer', async ({ page }) => {
    await fresh(page, '/staff/customers');
    await expect(page.locator('.cust-table tbody tr')).toHaveCount(25);
    await expect(page.locator('.card-head h2')).toContainText('1,248 of 1,248 customers');
    // The live customer is first.
    await expect(page.locator('.cust-table tbody tr').first()).toContainText('Olivia Carter');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('.pager')).toContainText('Page 2 of 50');
    await page.locator('.pills').getByRole('button', { name: 'Installment too low' }).click();
    await expect(page).toHaveURL(/filter=installment/);
    await expect(page.locator('.cust-table tbody tr .badge', { hasText: 'Installment too low' })).toHaveCount(25);
    await page.locator('.pills').getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('Search customers').fill('zzzz');
    await expect(page.locator('.cust-table')).toHaveCount(0);
    await page.getByLabel('Search customers').fill('olivia carter');
    await expect(page.locator('.cust-table tbody tr')).toHaveCount(1);
    await page.locator('.cust-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/staff\/customers\/C-2003418762$/);
    await expect(page.locator('.cust-head')).toContainText('Olivia Carter');
  });

  test('any other customer has a page too, and can be sent a message', async ({ page }) => {
    await fresh(page, '/staff/customers?filter=installment');
    const row = page.locator('.cust-table tbody tr').nth(1);
    const name = await row.getByRole('link').innerText();
    await row.click();
    await expect(page.locator('.cust-head h2')).toHaveText(name);
    await expect(page.locator('.attention-row').first()).toContainText('a month too low');
    await expect(page.locator('.cost-row')).toHaveCount(3);
    await page.locator('.attention-row').first().getByRole('link', { name: 'Send message' }).click();
    await expect(page).toHaveURL(/template=installment&customer=C-/);
    await expect(page.locator('.composer-to')).toContainText(name);
    await page.getByRole('button', { name: /^Send$/ }).click();
    await expect(page.locator('.outbox li').first()).toContainText(`To ${name}`);
    // Nothing lands in the live customer's inbox.
    expect(await (await page.request.get('/api/messages')).json()).toHaveLength(4);
  });

  test('live customer: suggested message → composer → contacted → done when the customer acts', async ({ page }) => {
    await fresh(page, LIVE);
    const row = page.locator('.attention-row', { hasText: 'Installment is €13 a month too low' });
    await expect(page.locator('.attention-row')).toHaveCount(3);
    await expect(page.locator('.attention .badge').first()).toHaveText('3 open');
    await row.getByRole('link', { name: 'Send message' }).click();
    await expect(page).toHaveURL(/\/staff\/messages\?template=installment$/);
    // The composer starts filled in, and the phone preview shows the same text.
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Advice: raise your installment to €198');
    await expect(page.locator('.phone-preview')).toContainText('Advice: raise your installment to €198');
    await expect(page.locator('.composer-to')).toContainText('Olivia Carter');
    await page.getByRole('button', { name: /^Send$/ }).click();
    await expect(page.locator('.outbox li').first()).toContainText('Not read yet');
    await page.goto(LIVE);
    await expect(row).toContainText('Message sent, not read yet');
    await expect(row.getByRole('link', { name: 'Send message' })).toHaveCount(0);
    // The customer raises the installment: the point is done, live.
    await page.request.post('/api/installment', { data: { amount: 198 } });
    await expect(page.locator('.attention-row', { hasText: 'Installment matches the advice' })).toContainText('Olivia changed it to €198 from December');
    await expect(page.locator('.attention .badge').first()).toHaveText('2 open');
  });

  test('live customer page: overview, tabs and timeline', async ({ page }) => {
    await fresh(page, LIVE);
    await expect(page.locator('.cust-head')).toContainText('Olivia Carter');
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThan(10);
    await expect(page.locator('.cost-row')).toHaveCount(3);
    await page.getByRole('tab', { name: /Contract & billing/ }).click();
    await expect(page.locator('.staff-table tbody tr')).toHaveCount(6);
    await page.getByRole('tab', { name: /Appliances/ }).click();
    await expect(page.locator('.appl-list li')).toHaveCount(8);
    await page.getByRole('tab', { name: /Messages/ }).click();
    await expect(page.locator('.outbox li')).toHaveCount(4); // the app inbox; nothing sent yet
    await page.getByRole('tab', { name: /Timeline/ }).click();
    await page.request.post('/api/installment', { data: { amount: 200 } });
    await expect(page.locator('.timeline-day .staff-feed')).toContainText('Changed installment to €200');
    // The old single-customer address still works.
    await page.goto('/staff/customer');
    await expect(page).toHaveURL(/\/staff\/customers\/C-2003418762$/);
  });

  test('messages: merge fields, schedule and cancel', async ({ page }) => {
    await fresh(page, '/staff/messages');
    await page.getByLabel('Title', { exact: true }).fill('About your installment');
    await page.locator('.staff-textarea').fill('Hi ');
    await page.getByRole('button', { name: 'First name' }).click();
    await page.locator('.staff-textarea').press('End');
    await page.locator('.staff-textarea').pressSequentially(', we advise ');
    await page.getByRole('button', { name: 'Advised installment' }).click();
    await expect(page.locator('.phone-preview')).toContainText('Hi Olivia, we advise €198');
    await page.getByLabel('When to send').selectOption('15m');
    await page.getByRole('button', { name: 'Schedule' }).click();
    const item = page.locator('.outbox li').first();
    await expect(item).toContainText('About your installment');
    await expect(item).toContainText('Scheduled for');
    // Nothing reached the customer yet.
    expect(await (await page.request.get('/api/messages')).json()).toHaveLength(4);
    await item.getByRole('button', { name: /Cancel/ }).click();
    await expect(item).toContainText('Cancelled');
  });

  test('AI assistant answers, and a draft opens in the composer', async ({ page }) => {
    await fresh(page, '/staff/assistant');
    // Empty state like the Hydro assistant: orb, greeting, four chips and "More questions".
    await expect(page.locator('.ai-orb')).toBeVisible();
    await expect(page.locator('.ai-greet')).toContainText('Hi Lotte');
    await expect(page.locator('.ai-chips .ai-chip')).toHaveCount(5);
    await page.getByRole('button', { name: 'More questions' }).click();
    await expect(page.locator('.ai-chips .ai-chip')).toHaveCount(11);
    await page.locator('.ai-chip', { hasText: 'Should the installment change?' }).click();
    const answer = page.locator('.ai-bubble.bot').last();
    await expect(answer).toContainText('€198');
    await expect(answer.locator('.ai-fact')).toHaveCount(3); // key numbers appear once the text has typed in
    await page.locator('#assistant-q').fill('Why is the bill higher this month?');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ai-bubble.bot').last().locator('.ai-chart svg')).toBeVisible();
    // A draft comes as a card with its own hand-off to the composer.
    await page.locator('#assistant-q').fill('Draft a message about smart charging');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ai-draft')).toContainText('Cheapest hours tonight');
    // Tool rail: recent questions, newest first.
    await page.getByRole('button', { name: 'Recent questions' }).click();
    await expect(page.locator('.ai-history button')).toHaveText(['Draft a message about smart charging', 'Why is the bill higher this month?', 'Should the installment change?']);
    await page.getByRole('button', { name: 'Recent questions' }).click();
    await page.locator('.ai-draft').getByRole('button', { name: 'Open in the composer' }).click();
    await expect(page).toHaveURL(/\/staff\/messages\?template=cheap-hours$/);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Cheapest hours tonight: 02:00–05:00');
    // The conversation is still there when you come back, until "New chat".
    await page.locator('.rs-rail').getByRole('link', { name: 'AI assistant', exact: true }).click();
    await expect(page.locator('.ai-turn')).toHaveCount(3);
    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(page.locator('.ai-orb')).toBeVisible();
  });

  test('reports: KPIs, charts and CSV export', async ({ page }) => {
    await fresh(page, '/staff/reports');
    await expect(page.locator('.staff-kpis .kpi')).toHaveCount(5);
    await expect(page.locator('.report-card')).toHaveCount(6);
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThan(20);
    const card = page.locator('.report-card', { hasText: 'Cost per month against the installment' });
    const [dl] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(dl.suggestedFilename()).toBe('cost-by-month.csv');
    const csv = (await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8')).split('\r\n');
    expect(csv[0]).toContain('Month,Cost EUR,Installment EUR,Difference EUR');
    expect(csv).toHaveLength(13);
    // Live numbers: a sent message shows up in the delivery report.
    await page.request.post('/api/staff/messages', { data: { title: 'Hello', body: 'Body text', push: false } });
    await expect(page.locator('.staff-kpis .kpi', { hasText: 'Messages read' })).toContainText('0/1');
  });

  test('audit log: live entries, filter and who did it', async ({ page }) => {
    await fresh(page, '/staff/audit');
    // Four automatic notifications, plus the reset this test started with.
    await expect(page.locator('.audit-table tbody tr')).toHaveCount(5);
    await expect(page.locator('.audit-table tbody tr').first()).toContainText('Demo reset');
    await page.request.post('/api/staff/messages', { data: { title: 'Hello Olivia', body: 'Body text', push: false } });
    const first = page.locator('.audit-table tbody tr').first();
    await expect(first).toContainText('Message sent');
    await expect(first).toContainText('Lotte');
    await expect(first).toContainText('Hello Olivia');
    await page.getByLabel('Filter by action').selectOption('ALERT_SENT');
    await expect(page.locator('.audit-table tbody tr')).toHaveCount(4);
    await page.getByLabel('Filter by action').selectOption('MESSAGE_SENT');
    await expect(page.locator('.audit-table tbody tr')).toHaveCount(1);
  });

  test('bell counts what the customer did and a banner announces it', async ({ page }) => {
    await fresh(page, '/staff');
    await expect(page.locator('.staff-conn')).toHaveClass(/live/, { timeout: 10_000 });
    await expect(page.locator('.staff-bell-count')).toHaveCount(0);
    await page.request.post('/api/installment', { data: { amount: 198 } });
    await expect(page.locator('.notice')).toContainText('Changed installment to €198');
    await expect(page.locator('.staff-bell-count')).toHaveText('1');
    await page.getByRole('button', { name: /Customer activity, 1 new/ }).click();
    await expect(page.locator('.staff-bell-pop')).toContainText('Changed installment to €198');
    await expect(page.locator('.staff-bell-count')).toHaveCount(0);
  });

  test('the phone preview is gone: its old address opens the dashboard', async ({ page }) => {
    await fresh(page, '/staff/preview');
    await expect(page.locator('h1')).toHaveText('Dashboard');
    await expect(page.locator('.rs-rail')).not.toContainText('Phone preview');
  });
});
