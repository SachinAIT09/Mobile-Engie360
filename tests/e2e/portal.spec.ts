import { ask, expect, fresh, openEva, test } from './fixtures';

// The customer app is a phone app: on a laptop it runs inside a phone-width column (last test below),
// so its screens are tested at phone size.
test.use({ viewport: { width: 390, height: 844 } });

test.describe('customer app: sign-in', () => {
  test('opens on the MijnENGIE sign-in and accepts the customer login', async ({ page }) => {
    await fresh(page, '/app', { signedIn: false });
    await expect(page).toHaveURL(/\/app\/login$/);
    await page.getByLabel('Email or customer number').fill('someone@else.nl');
    await page.getByLabel('Password', { exact: true }).fill('x');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('We don’t recognise that email address or customer number');
    await page.getByLabel('Email or customer number').fill('2003 418 762');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator('h1').first()).toHaveText(/^Good afternoon, Olivia/);
    // Staff see the sign-in.
    await expect.poll(async () => JSON.stringify(await (await page.request.get('/api/staff/activity')).json())).toContain('Signed in to MijnENGIE');
  });

  test('sign out returns to the sign-in screen; old links need a sign-in', async ({ page }) => {
    await fresh(page, '/app/account');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/app\/login$/);
    await page.goto('/billing');
    await expect(page).toHaveURL(/\/app\/login$/);
  });
});

test.describe('customer app: screens', () => {
  test('dashboard renders charts and filters', async ({ page }) => {
    await fresh(page);
    await expect(page.locator('h1').first()).toHaveText(/^Good afternoon, Olivia/);
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThan(5);
    await page.getByRole('tab', { name: 'Day' }).first().click();
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThanOrEqual(30);
  });

  test('notifications, profile and account edit', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: /Notifications/ }).click();
    // The inbox comes from the server, newest first; open the night-time alert specifically.
    await page.locator('.pop-item', { hasText: 'Unusual night-time consumption' }).click();
    await expect(page).toHaveURL(/\/app\/insights/);
    await page.locator('.app-bar').getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/app\/account$/);
    await page.getByRole('button', { name: /Edit/ }).click();
    // A wrong email or phone number is caught in the form and cannot be saved.
    await page.locator('input[type=email]').fill('not-an-email');
    await expect(page.locator('.modal')).toContainText('Enter a valid email address');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.locator('input[type=email]').fill('olivia.new@example.com');
    await page.locator('input[type=tel]').fill('12');
    await expect(page.locator('.modal')).toContainText('at least 6 digits');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.locator('input[type=tel]').fill('+31 6 1111 2222');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('+31 6 1111 2222')).toBeVisible();
    // Saved on the server: still there after a reload.
    await expect.poll(async () => (await (await page.request.get('/api/customer')).json()).customer.email).toBe('olivia.new@example.com');
    await page.reload();
    await expect(page.getByText('+31 6 1111 2222')).toBeVisible();
    await expect(page.getByText('olivia.new@example.com')).toBeVisible();
  });

  test('language and theme persist across reloads', async ({ page }) => {
    await fresh(page, '/app/account');
    await page.locator('#preferences').getByRole('button', { name: 'Dark', exact: true }).click();
    await page.locator('#preferences').getByRole('button', { name: 'Nederlands' }).click();
    await page.goto('/app');
    await page.reload();
    await expect(page.locator('h1').first()).toHaveText(/^Goedemiddag/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(10, 21, 36)');
  });

  test('energy: hour view, breakdown and table', async ({ page }) => {
    await fresh(page, '/app/energy');
    await page.getByRole('tab', { name: 'Hour' }).click();
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count()).toBeGreaterThanOrEqual(24);
    // The screen shows one part at a time: Usage · Breakdown · Trend.
    await page.getByRole('tab', { name: 'Breakdown' }).click();
    await expect(page.locator('.recharts-pie-sector')).toHaveCount(8);
    await page.getByRole('tab', { name: 'Trend' }).click();
    await page.getByRole('button', { name: 'Show monthly table' }).click();
    await expect(page.locator('table.table tbody tr')).toHaveCount(12);
  });

  test('billing: installment modal, invoice download, filters', async ({ page }) => {
    await fresh(page, '/app/billing?adjust=1');
    await expect(page.locator('.modal')).toBeVisible();
    await page.locator('.modal input[type=range]').fill('210');
    await expect(page.locator('.modal')).toContainText('Pay €56');
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(page.locator('.toast')).toContainText('210');
    await expect(page).toHaveURL(/\/billing$/);
    await page.getByRole('button', { name: /^View / }).first().click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.modal').getByRole('button', { name: /Download/ }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^[\w-]+\.pdf$/);
    // A real PDF, not a renamed web page.
    const { readFileSync } = await import('node:fs');
    expect(readFileSync((await dl.path())!, 'latin1').startsWith('%PDF-1.4')).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Annual' }).click();
    await expect(page.locator('#invoices tbody tr')).toHaveCount(1);
  });

  test('insights: savings plan', async ({ page }) => {
    await fresh(page, '/app/insights');
    const before = await page.locator('.list-row').count();
    // Insights are compact rows; the actions appear once a row is opened.
    await expect(page.getByRole('button', { name: /Add to plan/ })).toHaveCount(0);
    await page.locator('.insight-row:not(.planned)', { hasText: '/yr' }).first().locator('.insight-toggle').click();
    await page.getByRole('button', { name: /Add to plan/ }).first().click();
    await expect.poll(() => page.locator('.list-row').count()).toBeGreaterThan(before);
  });

  test('smart energy: live power and 15-minute charging plan', async ({ page }) => {
    await fresh(page, '/app/smart-energy');
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
    await openEva(page);
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
    // At phone size the chat closes to show the screen; open it again.
    await expect(page.locator('.chat-widget')).toHaveCount(0);
    await openEva(page);
    await page.getByRole('button', { name: 'Open full screen' }).click();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(page.locator('.chat-page .msg.user')).toHaveCount(suggestions.length + 3);
  });
});

test.describe('customer app: navigation like the Hydro Mobile360 customer app', () => {
  test('bottom tabs, Eva in the middle, sub-pages with a back arrow', async ({ page }) => {
    await fresh(page);
    const tabs = page.locator('.app-tabs');
    await expect(tabs.getByRole('link')).toHaveText(['Home', 'Energy', 'Billing', 'Profile']);
    await tabs.getByRole('link', { name: 'Energy' }).click();
    await expect(page).toHaveURL(/\/app\/energy$/);
    await page.locator('.link-card', { hasText: 'Smart Energy' }).click();
    await expect(page).toHaveURL(/\/app\/smart-energy$/);
    await expect(page.locator('.app-bar-title')).toHaveText('Smart Energy');
    await expect(tabs.getByRole('link', { name: 'Energy' })).toHaveClass(/active/);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/app\/energy$/);
    await openEva(page);
    // The chat covers the whole phone screen; its own close button closes it.
    await page.locator('.chat-widget').getByRole('button', { name: 'Close Eva' }).click();
    await expect(page.locator('.chat-widget')).toHaveCount(0);
  });

  test('no demo tools in the customer app', async ({ page }) => {
    await fresh(page);
    for (const text of ['Mobile preview', 'Customer Service', 'Start page', 'Website widget']) await expect(page.locator('body')).not.toContainText(text);
    await page.keyboard.press('Shift+P');
    await expect(page.locator('.presenter')).toHaveCount(0);
    // Old links land on the app home instead of a dead page.
    await page.goto('/website-demo');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('reads as a production app: no demo, sample-data or partner labels on any screen', async ({ page }) => {
    await fresh(page);
    for (const route of ['/app', '/app/energy', '/app/insights', '/app/smart-energy', '/app/billing', '/app/account', '/app/assistant']) {
      await page.goto(route);
      await expect(page.locator('.app-tabs')).toBeVisible();
      await expect(page.locator('body'), route).not.toContainText(/demo|sample|simulated|prototype|scripted|fictional|Net2Grid/i);
    }
    await page.goto('/app');
    await openEva(page);
    await expect(page.locator('.chat-widget')).not.toContainText(/demo|sample|scripted|Net2Grid/i);
    await expect(page).toHaveTitle('MijnENGIE');
  });

  test('old portal links move under /app', async ({ page }) => {
    await fresh(page, '/billing?adjust=1');
    await expect(page).toHaveURL(/\/app\/billing\?adjust=1$/);
    await expect(page.locator('.modal')).toBeVisible();
  });
});

test.describe('customer app on a laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows as a phone-width column, and the address bar follows it', async ({ page }) => {
    await fresh(page, '/app/energy');
    const column = page.locator('.phone-frame iframe');
    expect((await column.boundingBox())?.width).toBe(430);
    const app = page.frameLocator('.phone-frame iframe');
    await expect(app.locator('.app-tabs')).toBeVisible();
    await expect(app.locator('.app-tabs').getByRole('link', { name: 'Energy' })).toHaveClass(/active/);
    await app.locator('.app-tabs').getByRole('link', { name: 'Billing' }).click();
    await expect(page).toHaveURL(/\/app\/billing$/);
    await page.reload();
    await expect(page.frameLocator('.phone-frame iframe').locator('.app-tabs').getByRole('link', { name: 'Billing' })).toHaveClass(/active/);
    // The phone layout applies inside: Eva opens over the whole column.
    await page.frameLocator('.phone-frame iframe').locator('.app-eva').click();
    expect((await page.frameLocator('.phone-frame iframe').locator('.chat-widget').boundingBox())?.width).toBeGreaterThan(400);
  });
});

test('a finished payment plays the payment-done sound', async ({ page }) => {
  // Count the notes the page plays (the test cannot hear them).
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: number };
    w.__notes = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__notes++;
      return create.call(this);
    };
  });
  await fresh(page, '/app/billing');
  await page.getByRole('button', { name: 'Pay now instead' }).click();
  const sheet = page.locator('.modal.sheet');
  await sheet.getByRole('button', { name: /^Pay €185\.00/ }).click();
  // Nothing yet while it is processing…
  expect(await page.evaluate(() => (window as unknown as { __notes: number }).__notes)).toBe(0);
  await expect(sheet.locator('.pay-tick')).toBeVisible({ timeout: 8000 });
  // …and the chime (three notes) once the payment is done.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __notes: number }).__notes)).toBe(3);
});

test('voice to text in Eva: speak, the words appear in the box, then send', async ({ page }) => {
  // A stand-in for the browser's speech recognition: "hears" a question shortly after it starts.
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { __speechLang: string }).__speechLang = this.lang;
        setTimeout(() => this.onresult?.({ results: [[{ transcript: 'Why is my energy bill' }]] }), 150);
        setTimeout(() => this.onresult?.({ results: [[{ transcript: 'Why is my energy bill higher this month' }]] }), 300);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    // Chrome has both names; the app prefers the unprefixed one.
    const w = window as unknown as { SpeechRecognition: unknown; webkitSpeechRecognition: unknown };
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
  await fresh(page);
  await openEva(page);
  const box = page.locator('.chat-input textarea');
  await page.getByRole('button', { name: 'Speak your question' }).click();
  // While listening the button says so, and the words arrive as they are spoken.
  await expect(page.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true');
  await expect(box).toHaveValue('Why is my energy bill higher this month');
  expect(await page.evaluate(() => (window as unknown as { __speechLang: string }).__speechLang)).toBe('en-US');
  await page.getByRole('button', { name: 'Stop listening' }).click();
  await expect(page.getByRole('button', { name: 'Speak your question' })).toBeVisible();
  // Nothing was sent by speaking; the customer sends it.
  await expect(page.locator('.msg.user')).toHaveCount(0);
  await page.locator('.chat-send').click();
  await expect(page.locator('.msg.bot .bubble').last()).toContainText('12% higher');
});
