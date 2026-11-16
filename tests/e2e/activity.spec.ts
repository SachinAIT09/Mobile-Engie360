import { expect, mobLogin, shot, test, urls } from './fixtures';
import { MANNY, demoState } from './helpers';

interface ActivityRow {
  customerId: string;
  kind: string;
  summary: string;
}

/** Everything a customer does on the phone shows up live in the staff app: bell, toast, feed, timeline. */
test.describe('Customer activity', () => {
  test.beforeEach(async ({ api }) => {
    await api.reset();
  });

  test('sign-in, payment and a bill-history view reach staff live', async ({ web, mob, api }) => {
    const staff = await api.staffToken();
    const kinds = async () => (await api.call<ActivityRow[]>('/activity?limit=50', 'GET', undefined, staff)).map((a) => a.kind);

    await web.goto(`${urls.WEB}/activity`);
    await expect(web.getByRole('heading', { name: 'Customer activity' })).toBeVisible({ timeout: 20_000 });
    await expect(web.getByText(/no app activity yet/i)).toBeVisible();

    // Sign-in: toast, bell badge, live row.
    await mobLogin(mob, MANNY);
    const toasts = web.locator('.act-toasts');
    await expect(toasts.getByText('Signed in to the app')).toBeVisible();
    await expect(web.getByRole('button', { name: /customer activity, \d+ new/i })).toBeVisible();
    await expect(web.locator('tbody').getByText('Signed in to the app')).toBeVisible();

    // Payment through the mocked checkout.
    await mob.goto(`${urls.MOB}/pay`);
    for (let i = 0; i < 2; i++) {
      const next = mob.getByRole('button', { name: /^continue/i }).filter({ visible: true }).first();
      await expect(next).toBeVisible({ timeout: 20_000 });
      await next.click();
    }
    await mob.getByRole('button', { name: /^pay \$?[\d,.]+/i }).first().click();
    await expect(toasts.getByText(/^Paid \$[\d,.]+ by /)).toBeVisible({ timeout: 20_000 });
    await expect(web.locator('tbody').getByText(/^Paid \$[\d,.]+ by .+ · /)).toBeVisible();

    // A read-only screen is reported too.
    await mob.goto(`${urls.MOB}/bill-history`);
    await expect.poll(kinds, { timeout: 20_000 }).toContain('VIEWED_BILL_HISTORY');
    await expect(web.locator('tbody').getByText('Looked through past bills')).toBeVisible();
    await shot(web, 'activity-feed');

    // Bell panel lists it and clears the badge; the customer timeline has every step.
    await web.getByRole('button', { name: /customer activity/i }).click();
    const panel = web.getByRole('region', { name: 'Customer activity' });
    await expect(panel.getByText(/Paid \$/)).toBeVisible();
    await expect(web.getByRole('button', { name: /customer activity, \d+ new/i })).toHaveCount(0);

    const manny = (await demoState(api)).customers.find((c) => c.email === MANNY)!;
    await web.goto(`${urls.WEB}/customers/${manny.customerId}`);
    await expect(web.locator('.act-timeline').getByText(/Paid \$[\d,.]+ by /)).toBeVisible({ timeout: 20_000 });
    await expect(web.locator('.act-timeline').getByText('Signed in to the app')).toBeVisible();
    await expect(web.getByText('App open now')).toBeVisible();

    // Live on the timeline too: turn on AutoPay.
    await mob.goto(`${urls.MOB}/autopay`);
    await mob.getByRole('button', { name: /turn on autopay/i }).or(mob.getByText(/turn on autopay/i)).filter({ visible: true }).first().click();
    await expect(web.locator('.act-timeline').getByText(/AutoPay on, paying by/)).toBeVisible({ timeout: 20_000 });
    await shot(web, 'activity-customer', true);
  });
});
