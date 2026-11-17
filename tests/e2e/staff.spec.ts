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
      ['Messages', /\/staff\/messages$/, 'Messages'],
      ['Reports', /\/staff\/reports$/, 'Reports'],
      ['Eva', /\/staff\/assistant$/, 'Eva'],
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
    // 10 rows a page, more behind the pager; the page size can be changed.
    await expect(page.locator('.staff-table tbody tr')).toHaveCount(10);
    await page.locator('.pager-size select').selectOption('30');
    await expect(page.locator('.staff-table tbody tr')).toHaveCount(30);
    await page.locator('.pager-size select').selectOption('10');
    await expect(page.locator('.pager')).toContainText(/Page 1 of [2-9]/);
    await page.getByLabel('Search activity').fill('olivia');
    await expect(page.locator('.staff-table tbody tr')).toHaveCount(2);
    await page.getByLabel('Search activity').fill('');
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
    await expect(page.locator('.aud-group.on')).toContainText('Installment too low');
    await expect(page.locator('.aud-group.on .aud-count')).toHaveText(String(count - 1));
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Advice: raise your installment to €198');
    await page.getByRole('button', { name: `Send to ${count - 1}` }).click();
    await expect(page.locator('.toast').last()).toContainText(`Sent to ${count - 1} customers`);
    const sent = page.locator('.history-table tbody tr').first();
    await expect(sent).toContainText(`${count - 1} customers`);
    await expect(sent).toContainText('Installment too low');
    await expect(sent.locator('.badge')).toContainText('Sent');
    // It did not go to the live customer, who no longer needs it.
    expect(await (await page.request.get('/api/messages')).json()).toHaveLength(4);
    await page.locator('.rs-rail').getByRole('link', { name: 'Dashboard', exact: true }).click();
    // The count itself can drop by one while this runs: sample customers keep acting (one may fix their
    // installment), so check the state, not the exact number.
    await expect(queue).toContainText(/All \d+ messaged today/);
    await expect(queue.getByRole('link', { name: 'Message again' })).toBeVisible();
  });

  test('customer list: search, filter, paging, open a customer', async ({ page }) => {
    await fresh(page, '/staff/customers');
    await expect(page.locator('.cust-table tbody tr')).toHaveCount(10);
    await expect(page.locator('.pager')).toContainText('1–10 of 1,248');
    await expect(page.locator('.card-head h2')).toContainText('1,248 of 1,248 customers');
    // The live customer is first.
    await expect(page.locator('.cust-table tbody tr').first()).toContainText('Olivia Carter');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('.pager')).toContainText('Page 2 of 125');
    // Rows per page: 10, 15, 30 or 50.
    await expect(page.locator('.pager-size option')).toHaveText(['10', '15', '30', '50']);
    await page.locator('.pager-size select').selectOption('50');
    await expect(page.locator('.cust-table tbody tr')).toHaveCount(50);
    await expect(page.locator('.pager')).toContainText('1–50 of 1,248 · Page 1 of 25');
    await page.locator('.pager-size select').selectOption('10');
    await page.locator('.pills').getByRole('button', { name: 'Installment too low' }).click();
    await expect(page).toHaveURL(/filter=installment/);
    await expect(page.locator('.cust-table tbody tr .badge', { hasText: 'Installment too low' })).toHaveCount(10);
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
    await expect(page.locator('.aud-picked')).toContainText(name);
    await page.getByRole('button', { name: /^Send$/ }).click();
    await expect(page.locator('.history-table tbody tr').first()).toContainText(name);
    // Nothing lands in the live customer's inbox.
    expect(await (await page.request.get('/api/messages')).json()).toHaveLength(4);
  });

  test('live customer: suggested message → composer → contacted → done when the customer acts', async ({ page }) => {
    await fresh(page, LIVE);
    const row = page.locator('.attention-row', { hasText: 'Installment is €13 a month too low' });
    await expect(page.locator('.attention-row')).toHaveCount(3);
    await expect(page.locator('.attention .badge').first()).toHaveText('3 open');
    await row.getByRole('link', { name: 'Send message' }).click();
    await expect(page).toHaveURL(/\/staff\/messages\?template=installment&customer=C-2003418762$/);
    // The composer starts filled in, and the phone preview shows the same text.
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Advice: raise your installment to €198');
    await expect(page.locator('.phone-preview')).toContainText('Advice: raise your installment to €198');
    await expect(page.locator('.aud-picked')).toContainText('Olivia Carter');
    await page.getByRole('button', { name: /^Send$/ }).click();
    await expect(page.locator('.history-table tbody tr').first()).toContainText('Not yet');
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

  test('messages: pick a recipient, merge fields, schedule and cancel, history filters', async ({ page }) => {
    await fresh(page, '/staff/messages');
    // Results of earlier messages, and their history, are there from the start.
    await expect(page.locator('.msg-stats .kpi')).toHaveCount(4);
    await expect(page.locator('.history-table tbody tr')).toHaveCount(9);
    await expect(page.locator('.history-card .pager')).toContainText('1–9 of 9 · Page 1 of 1');
    // Nothing can be sent until someone is chosen.
    await page.getByLabel('Title', { exact: true }).fill('About your installment');
    await page.locator('.staff-textarea').fill('Hi ');
    await expect(page.getByRole('button', { name: /^Send$/ })).toBeDisabled();
    await page.getByRole('button', { name: 'One customer' }).click();
    await page.getByLabel('Find a customer').fill('olivia car');
    await page.locator('.aud-results button', { hasText: 'Olivia Carter' }).click();
    await expect(page.locator('.aud-picked')).toContainText('Olivia Carter');
    // Merge fields fill in with this customer's data.
    await page.getByLabel('Title', { exact: true }).fill('About your installment');
    await page.locator('.staff-textarea').fill('Hi ');
    await page.getByRole('button', { name: 'First name' }).click();
    await page.locator('.staff-textarea').press('End');
    await page.locator('.staff-textarea').pressSequentially(', we advise ');
    await page.getByRole('button', { name: 'Advised installment' }).click();
    await expect(page.locator('.phone-preview')).toContainText('Hi Olivia, we advise €198');
    await page.getByLabel('When to send').selectOption('15m');
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    const item = page.locator('.history-table tbody tr').first();
    await expect(item).toContainText('About your installment');
    await expect(item).toContainText('Scheduled');
    // Nothing reached the customer yet.
    expect(await (await page.request.get('/api/messages')).json()).toHaveLength(4);
    await page.locator('.history-card .pills').getByRole('button', { name: 'Scheduled' }).click();
    await expect(page.locator('.history-table tbody tr')).toHaveCount(1);
    await item.getByRole('button', { name: /Cancel/ }).click();
    await expect(page.locator('.history-table')).toHaveCount(0); // no scheduled messages left
    await page.locator('.history-card .pills').getByRole('button', { name: 'Cancelled' }).click();
    await expect(page.locator('.history-table tbody tr')).toHaveCount(1);
    await page.getByLabel('Filter by recipient').selectOption('group');
    await expect(page.locator('.history-table')).toHaveCount(0);
  });

  test('Eva (staff assistant) answers about the whole customer base, and a draft opens in the composer', async ({ page }) => {
    await fresh(page, '/staff/assistant');
    // Empty state like the Hydro assistant: orb, greeting and six suggestion chips (no "More questions").
    await expect(page.locator('.ai-orb')).toBeVisible();
    await expect(page.locator('.ai-title')).toHaveText('Eva');
    await expect(page.locator('.ai-greet')).toContainText('Hi Lotte, I’m Eva');
    await expect(page.locator('.ai-chips .ai-chip')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'More questions' })).toHaveCount(0);
    await page.locator('.ai-chip', { hasText: 'How many customers have an installment that is too low?' }).click();
    const answer = page.locator('.ai-bubble.bot').last();
    await expect(answer).toContainText(/\d+ customers \(\d+%\) pay an installment below the advised amount/);
    await expect(answer.locator('.ai-fact')).toHaveCount(3); // key numbers appear once the text has typed in
    // The chart's bars have real height (not a sliver).
    const bar = answer.locator('.ai-chart .ai-bar').first();
    expect((await bar.boundingBox())!.height).toBeGreaterThan(40);
    // One customer, by name.
    await page.locator('#assistant-q').fill('Tell me about Olivia Carter');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ai-bubble.bot').last()).toContainText('2003 418 762');
    // A draft comes as a card with its own hand-off to the composer, addressed to the group.
    await page.locator('#assistant-q').fill('Draft a message about smart charging');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ai-draft')).toContainText('Cheapest hours tonight');
    // Tool rail: recent questions, newest first.
    await page.getByRole('button', { name: 'Recent questions' }).click();
    await expect(page.locator('.ai-history button')).toHaveText(['Draft a message about smart charging', 'Tell me about Olivia Carter', 'How many customers have an installment that is too low?']);
    await page.getByRole('button', { name: 'Recent questions' }).click();
    await page.locator('.ai-draft').getByRole('button', { name: 'Open in the composer' }).click();
    await expect(page).toHaveURL(/\/staff\/messages\?segment=ev-peak&template=cheap-hours$/);
    await expect(page.locator('.aud-group.on')).toContainText('EV charging at peak hours');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Cheapest hours tonight: 02:00–05:00');
    // The conversation is still there when you come back, until "New chat".
    await page.locator('.rs-rail').getByRole('link', { name: 'Eva', exact: true }).click();
    await expect(page.locator('.ai-turn')).toHaveCount(3);
    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(page.locator('.ai-orb')).toBeVisible();
  });

  test('reports for the whole base: filters drive every chart, tables page, CSV export', async ({ page }) => {
    await fresh(page, '/staff/reports');
    await expect(page.locator('.staff-kpis .kpi')).toHaveCount(5);
    await expect(page.locator('.report-card')).toHaveCount(6);
    await expect(page.locator('.report-scope')).toContainText('1,248 of 1,248 customers');
    // Message delivery has real history behind it.
    const delivery = page.locator('.report-card', { hasText: 'Message delivery' });
    await expect(delivery).toContainText('9 messages to groups in this period');
    await expect(delivery.locator('.appl-list li')).toHaveCount(4);
    await expect(delivery.locator('tbody tr')).toHaveCount(9);
    await expect(delivery.locator('.pager')).toContainText('1–9 of 9');
    // Period: fewer months in every monthly chart, fewer messages.
    const energy = page.locator('.report-card', { hasText: 'Energy delivered by' });
    await expect.poll(() => energy.locator('.recharts-bar-rectangle').count()).toBe(12);
    await page.getByLabel('Filter by period').selectOption('3');
    await expect.poll(() => energy.locator('.recharts-bar-rectangle').count()).toBe(3);
    await expect(delivery).toContainText('7 messages to groups in this period');
    // Last 7 days: the monthly charts become daily ones.
    await page.getByLabel('Filter by period').selectOption('week');
    await expect.poll(() => energy.locator('.recharts-bar-rectangle').count()).toBe(7);
    await expect(page.locator('.report-card', { hasText: 'Energy delivered by day' })).toBeVisible();
    await expect(delivery).toContainText('2 messages to groups in this period');
    await page.getByLabel('Filter by period').selectOption('3');
    // City: the whole page narrows to that city.
    await page.getByLabel('Filter by city').selectOption('Utrecht');
    await expect(page.locator('.report-scope')).toContainText(/^\d+ of 1,248 customers/);
    const cities = page.locator('.report-card', { hasText: 'Customers by city' });
    await expect(cities.locator('tbody tr')).toHaveCount(1);
    await expect(cities.locator('tbody tr')).toContainText('Utrecht');
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('.report-scope')).toContainText('1,248 of 1,248 customers');
    await expect(cities.locator('tbody tr')).toHaveCount(10);
    await expect(cities.locator('.pager')).toContainText('1–10 of 12 · Page 1 of 2');
    await cities.locator('.pager-size select').selectOption('15');
    await expect(cities.locator('tbody tr')).toHaveCount(12);
    // Export, and the export is in the audit log.
    const [dl] = await Promise.all([page.waitForEvent('download'), cities.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(dl.suggestedFilename()).toBe('customers-by-city.csv');
    const csv = (await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8')).split('\r\n');
    expect(csv[0]).toContain('City,Customers,Need attention,Installment too low,EV at peak hours');
    expect(csv).toHaveLength(13);
    await page.locator('.rs-rail').getByRole('link', { name: 'Audit log', exact: true }).click();
    await expect(page.locator('.audit-table tbody tr').first()).toContainText('Report exported');
    await expect(page.locator('.audit-table tbody tr').first()).toContainText('Customers by city');
  });

  test('audit log: the team\'s work, live entries, filters and paging', async ({ page }) => {
    await fresh(page, '/staff/audit');
    await expect(page.locator('.audit-table tbody tr')).toHaveCount(10);
    await page.locator('.pager-size select').selectOption('50');
    await expect(page.locator('.audit-table tbody tr')).toHaveCount(50);
    await page.locator('.pager-size select').selectOption('10');
    await expect(page.locator('.audit-table tbody tr').first()).toContainText('Demo reset'); // this test started with a reset
    await expect(page.locator('.card-head')).toContainText('4 staff members');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('.pager')).toContainText(/Page 2 of \d+/);
    // A message sent now shows up at the top, with who sent it.
    await page.request.post('/api/staff/messages', { data: { title: 'Hello Olivia', body: 'Body text', push: false } });
    await page.locator('.pills').getByRole('button', { name: 'Messages' }).click();
    const first = page.locator('.audit-table tbody tr').first();
    await expect(first).toContainText('Message sent');
    await expect(first).toContainText('Lotte');
    await expect(first).toContainText('Hello Olivia');
    // Person, period and text filters.
    await page.getByLabel('Filter by person').selectOption('Megan Brooks');
    await expect(page.locator('.audit-table tbody tr').first()).toContainText('Megan Brooks');
    await expect(page.locator('.audit-table')).not.toContainText('Lotte');
    await page.getByLabel('Filter by person').selectOption('');
    await page.locator('.pills').getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('Search the log').fill('hello olivia');
    await expect(page.locator('.audit-table tbody tr')).toHaveCount(1);
    await page.getByLabel('Search the log').fill('');
    await page.getByLabel('Filter by period').selectOption('today');
    await expect(page.locator('.audit-table tbody tr').last()).toContainText(/ago|just now/);
    // Opening a customer record is logged too.
    await page.goto('/staff/customers/C-2003418762');
    await expect(page.locator('.cust-head')).toContainText('Olivia Carter');
    await page.goto('/staff/audit');
    await page.locator('.pills').getByRole('button', { name: 'Customer records' }).click();
    await expect(page.locator('.audit-table tbody tr').first()).toContainText('Olivia Carter');
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
