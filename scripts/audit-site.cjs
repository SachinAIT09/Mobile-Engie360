/*
 * Audit sweep for ENGIE360, usable against a local server or the hosted site.
 *   npm run audit:site -- <baseUrl> <outDir> [--quick]
 *   e.g. npm run audit:site -- http://localhost:3000 .audit-out   (or the hosted address)
 * Part 1: every route at five screen sizes (and dark theme at two): console errors, page errors, failed
 *         requests, blank pages, sideways overflow, load time. The customer app at >= 700 px runs inside
 *         its phone-column iframe, so that frame is inspected too.
 * Part 2: every internal link found on those pages answers.
 * Part 3: API: every GET answers with JSON; bad input gives a 4xx with an error message, never a 5xx.
 * Part 4: security: headers, path traversal, script injection through a staff message.
 * Prints one line per finding and writes <outDir>/audit.json.
 */
const { chromium } = require(process.cwd() + '/node_modules/@playwright/test');
const fs = require('node:fs');

const BASE = process.argv[2].replace(/\/+$/, '');
const OUT = process.argv[3];
const QUICK = process.argv.includes('--quick');
const SESSION = 'C-2003418762';
fs.mkdirSync(OUT, { recursive: true });

const CUSTOMER = ['/app', '/app/energy', '/app/billing', '/app/insights', '/app/smart-energy', '/app/assistant', '/app/account'];
const STAFF = ['/staff', '/staff/customers', `/staff/customers/${SESSION}`, '/staff/activity', '/staff/messages', '/staff/assistant', '/staff/reports', '/staff/audit', '/staff/demo'];
const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const findings = [];
const stats = { pages: 0, pageChecks: 0, links: 0, api: 0, apiPass: 0, security: 0, securityPass: 0, loadMs: [] };
const note = (severity, area, where, what) => {
  findings.push({ severity, area, where, what });
  console.log(`[${severity}] ${area} | ${where} | ${what}`);
};

// Console noise that is not the app's fault.
const IGNORE = [/Download the React DevTools/i, /\[vite\]/i, /favicon/i];

async function visit(browser, route, vp, { signedIn = true, theme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
  await ctx.addInitScript(
    ({ s, signedIn, theme }) => {
      localStorage.setItem('engie-demo-lang', 'en');
      localStorage.setItem('engie-demo-theme', theme);
      sessionStorage.setItem('engie-demo-started', '1'); // not a fresh launch: no data reset mid-audit
      if (signedIn) localStorage.setItem('engie-demo-session', s);
    },
    { s: SESSION, signedIn, theme },
  );
  const page = await ctx.newPage();
  const where = `${route} @ ${vp.name}${theme === 'dark' ? ' dark' : ''}`;
  const problems = [];
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`console ${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message.slice(0, 200)}`));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText ?? '';
    if (!/ERR_ABORTED/.test(f) && !/\/api\/events/.test(r.url())) problems.push(`request failed: ${r.url().replace(BASE, '')} ${f}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url().replace(BASE, '')}`);
  });
  const t0 = Date.now();
  let links = [];
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // The app answers "Starting the demo…" while a sleeping service wakes; wait for the real page.
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(900);
    stats.loadMs.push(Date.now() - t0);
    const framed = await page.locator('.phone-frame iframe').count();
    const target = framed ? page.frames().find((f) => f !== page.mainFrame()) : page.mainFrame();
    if (framed && !target) problems.push('phone column iframe did not load');
    const info = target
      ? await target.evaluate(() => {
          const de = document.documentElement;
          const text = (document.body.innerText || '').trim();
          const clipped = [];
          for (const el of document.querySelectorAll('main *, header *, nav *')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > innerWidth + 2 && getComputedStyle(el).position !== 'fixed') {
              // Inside a sideways scroller is fine; outside one it is cut off.
              let p = el.parentElement;
              let scroller = false;
              while (p) {
                const o = getComputedStyle(p).overflowX;
                if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroller = true; break; }
                p = p.parentElement;
              }
              if (!scroller) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
            }
          }
          return {
            text: text.length,
            overflow: de.scrollWidth - innerWidth,
            clipped: [...new Set(clipped)].slice(0, 4),
            title: document.title,
            url: location.pathname,
            images: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src).slice(0, 3),
            links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && h.startsWith('/')),
            smallTargets: innerWidth < 700 ? [...document.querySelectorAll('button:not([role=switch]), a.btn, [role=tab]')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 28 || r.width < 28); }).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30)).slice(0, 4) : [],
            unlabelled: [...document.querySelectorAll('button')].filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
          };
        })
      : null;
    if (info) {
      links = info.links;
      if (info.text < 40) problems.push(`page looks blank (${info.text} characters of text)`);
      if (info.overflow > 1) problems.push(`sideways overflow of ${info.overflow}px`);
      if (info.clipped.length) problems.push(`content cut off at the right edge: ${info.clipped.join(', ')}`);
      if (info.images.length) problems.push(`broken image: ${info.images.join(', ')}`);
      if (info.smallTargets.length) problems.push(`very small touch targets: ${info.smallTargets.join(' | ')}`);
      if (info.unlabelled) problems.push(`${info.unlabelled} icon-only button(s) without a label`);
    }
    if (!QUICK || vp.name === 'mobile-390' || vp.name === 'laptop-1366') await page.screenshot({ path: `${OUT}/${(route.replace(/[^a-z0-9]+/gi, '_') || 'root')}-${vp.name}${theme === 'dark' ? '-dark' : ''}.png` }).catch(() => undefined);
  } catch (e) {
    problems.push(`navigation failed: ${String(e.message).split('\n')[0].slice(0, 160)}`);
  }
  stats.pages++;
  stats.pageChecks += 6;
  for (const p of [...new Set(problems)]) note(/blank|navigation failed|page error|iframe did not/.test(p) ? 'HIGH' : /HTTP 5|request failed|console error/.test(p) ? 'MEDIUM' : 'LOW', 'page', where, p);
  await ctx.close();
  return links;
}

async function api(method, path, body, raw) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, { method, headers: body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text, ms: Date.now() - t0, headers: res.headers };
}

async function expectApi(name, method, path, body, check, raw) {
  stats.api++;
  try {
    const r = await api(method, path, body, raw);
    const problem = check(r);
    if (problem) note(r.status >= 500 ? 'HIGH' : 'MEDIUM', 'api', `${method} ${path}`, `${name}: ${problem} (status ${r.status}${r.json?.error ? `, "${r.json.error.message}"` : ''})`);
    else stats.apiPass++;
    if (r.ms > 1500) note('LOW', 'api', `${method} ${path}`, `slow: ${r.ms} ms`);
    return r;
  } catch (e) {
    note('HIGH', 'api', `${method} ${path}`, `${name}: request threw ${String(e.message).slice(0, 120)}`);
    return null;
  }
}

const ok = (shape) => (r) => (r.status !== 200 ? 'expected 200' : !r.json ? 'not JSON' : shape && !shape(r.json) ? 'unexpected response shape' : null);
const rejected = (...codes) => (r) => (!codes.includes(r.status) ? `expected ${codes.join(' or ')}` : r.status !== 405 && !r.json?.error?.message ? 'no error message in the body' : null);
const noContent = (r) => (r.status !== 204 && r.status !== 200 ? 'expected 200 or 204' : null);

(async () => {
  console.log(`\n=== Audit of ${BASE} ===`);
  // wake a sleeping service
  for (let i = 0; i < 12; i++) { const h = await api('GET', '/api/health').catch(() => null); if (h?.status === 200) break; await new Promise((r) => setTimeout(r, 4000)); }
  await api('POST', '/api/demo/reset', {});

  const browser = await chromium.launch({ channel: 'chrome' });
  const allLinks = new Set();

  // ---- Part 1: pages
  console.log('\n--- pages');
  const vps = QUICK ? VIEWPORTS.filter((v) => ['mobile-390', 'laptop-1366'].includes(v.name)) : VIEWPORTS;
  for (const vp of vps) {
    for (const l of await visit(browser, '/', vp)) allLinks.add(l);
    for (const l of await visit(browser, '/app/login', vp, { signedIn: false })) allLinks.add(l);
    for (const r of [...CUSTOMER, ...STAFF]) for (const l of await visit(browser, r, vp)) allLinks.add(l);
  }
  for (const vp of VIEWPORTS.filter((v) => ['mobile-390', 'laptop-1366'].includes(v.name))) {
    await visit(browser, '/', vp, { theme: 'dark' });
    for (const r of [...CUSTOMER, ...STAFF]) await visit(browser, r, vp, { theme: 'dark' });
  }

  // ---- routing behaviour
  console.log('\n--- routing');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const route = async (name, from, expectPath, prep) => {
    stats.pageChecks++;
    try {
      if (prep) await prep();
      await p.goto(BASE + from, { waitUntil: 'networkidle', timeout: 45000 });
      await p.waitForURL((u) => expectPath.test(u.pathname + u.search), { timeout: 8000 }).catch(() => undefined);
      const got = new URL(p.url()).pathname + new URL(p.url()).search;
      if (!expectPath.test(got)) note('MEDIUM', 'routing', from, `${name}: ended at ${got}`);
    } catch (e) { note('HIGH', 'routing', from, `${name}: ${String(e.message).split('\n')[0]}`); }
  };
  await p.goto(BASE + '/app/login', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('engie-demo-lang', 'en'); sessionStorage.setItem('engie-demo-started', '1'); });
  await route('signed out: a protected screen sends you to sign-in', '/app/billing', /^\/app\/login$/);
  await route('signed out: home sends you to sign-in', '/app', /^\/app\/login$/);
  await route('signed out: an old portal link sends you to sign-in', '/billing?adjust=1', /^\/app\/login$/);
  await p.evaluate((s) => localStorage.setItem('engie-demo-session', s), SESSION);
  await route('signed in: sign-in screen sends you home', '/app/login', /^\/app\/?$/);
  await route('old portal link moves under /app', '/energy', /^\/app\/energy$/);
  await route('unknown customer route goes home', '/app/does-not-exist', /^\/app\/?$/);
  await route('unknown staff route goes to the dashboard', '/staff/does-not-exist', /^\/staff\/?$/);
  await route('removed staff page goes somewhere valid', '/staff/conversations', /^\/staff/);
  // back / forward and refresh
  stats.pageChecks += 2;
  await p.goto(BASE + '/app', { waitUntil: 'networkidle' });
  await p.locator('.app-tabs').getByRole('link', { name: 'Energy' }).click();
  await p.locator('.app-tabs').getByRole('link', { name: 'Billing' }).click();
  await p.goBack(); await p.waitForTimeout(300);
  if (!/\/app\/energy$/.test(p.url())) note('MEDIUM', 'routing', 'back', `browser back ended at ${p.url()}`);
  await p.goForward(); await p.waitForTimeout(300);
  if (!/\/app\/billing$/.test(p.url())) note('MEDIUM', 'routing', 'forward', `browser forward ended at ${p.url()}`);
  await p.reload({ waitUntil: 'networkidle' });
  if (!/\/app\/billing$/.test(p.url()) || !(await p.locator('h1').first().innerText()).includes('bills')) note('MEDIUM', 'routing', 'refresh', 'a refresh did not keep the Billing screen');
  await ctx.close();
  await browser.close();

  // ---- Part 2: links
  console.log('\n--- links');
  for (const l of [...allLinks].sort()) {
    stats.links++;
    const r = await fetch(BASE + l, { redirect: 'follow' }).catch(() => null);
    if (!r || r.status >= 400) note('MEDIUM', 'link', l, `link answers ${r ? r.status : 'nothing'}`);
  }

  // ---- Part 3: API
  console.log('\n--- api');
  await api('POST', '/api/demo/reset', {});
  await expectApi('health', 'GET', '/api/health', undefined, ok((j) => j.ok === true));
  await expectApi('customer', 'GET', '/api/customer', undefined, ok((j) => j.customer?.id === SESSION && j.installment));
  await expectApi('energy', 'GET', '/api/energy', undefined, ok((j) => j.monthly?.length === 12 && j.hourly?.length === 24));
  const bill = await expectApi('billing', 'GET', '/api/billing', undefined, ok((j) => j.invoices?.length === 13 && j.pay?.autopay === true && Array.isArray(j.payments)));
  await expectApi('insights', 'GET', '/api/insights', undefined, ok((j) => Array.isArray(j.insights) && Array.isArray(j.plan)));
  await expectApi('messages', 'GET', '/api/messages', undefined, ok((j) => Array.isArray(j) && j.length >= 4));
  for (const g of ['/api/staff/overview', '/api/staff/activity', '/api/staff/conversations', '/api/staff/templates', '/api/staff/attention', '/api/staff/outbox', '/api/staff/audit', '/api/staff/reports', '/api/staff/reports?months=3', '/api/staff/reports?months=week', '/api/staff/portfolio', '/api/staff/feed', '/api/staff/customers', `/api/staff/customers/${SESSION}`, '/api/push/key', '/api/demo/info'])
    await expectApi('staff/demo read', 'GET', g, undefined, ok());
  await expectApi('unknown customer', 'GET', '/api/staff/customers/NOPE', undefined, rejected(404));
  await expectApi('reports with nonsense filters', 'GET', '/api/staff/reports?months=abc&city=%3Cscript%3E&group=zzz', undefined, (r) => (r.status >= 500 ? 'server error on bad filters' : null));
  await expectApi('customers with nonsense paging', 'GET', '/api/staff/customers?page=-5&size=99999&q=%27%20OR%201%3D1', undefined, (r) => (r.status >= 500 ? 'server error on bad paging' : null));

  // installment
  await expectApi('installment too low', 'POST', '/api/installment', { amount: 50 }, rejected(400));
  await expectApi('installment not whole', 'POST', '/api/installment', { amount: 198.5 }, rejected(400));
  await expectApi('installment as text', 'POST', '/api/installment', { amount: 'abc' }, rejected(400));
  await expectApi('installment missing', 'POST', '/api/installment', {}, rejected(400));
  await expectApi('installment valid', 'POST', '/api/installment', { amount: 198 }, ok((j) => j.pending?.amount === 198));
  await expectApi('installment persisted', 'GET', '/api/billing', undefined, ok((j) => j.installment?.pending?.amount === 198));
  // payments
  const open = bill?.json?.invoices?.find((i) => i.status !== 'paid');
  await expectApi('pay unknown invoice', 'POST', '/api/billing/pay', { invoiceId: 'NOPE', method: 'ideal' }, rejected(400, 404));
  await expectApi('pay unknown method', 'POST', '/api/billing/pay', { invoiceId: open?.id, method: 'bitcoin' }, rejected(400));
  await expectApi('pay missing fields', 'POST', '/api/billing/pay', {}, rejected(400));
  await expectApi('pay valid', 'POST', '/api/billing/pay', { invoiceId: open?.id, method: 'ideal', bank: 'ING' }, ok((j) => j.paid?.length === 1));
  await expectApi('pay twice is refused (no duplicate payment)', 'POST', '/api/billing/pay', { invoiceId: open?.id, method: 'ideal' }, rejected(400));
  await expectApi('paid invoice shows as paid', 'GET', '/api/billing', undefined, ok((j) => j.invoices.find((i) => i.id === open?.id)?.status === 'paid' && j.payments[0]?.invoiceId === open?.id));
  await expectApi('autopay not a boolean', 'POST', '/api/billing/autopay', { on: 'yes' }, rejected(400));
  await expectApi('autopay off', 'POST', '/api/billing/autopay', { on: false }, ok((j) => j.autopay === false));
  // plan, charging, contact, messages
  await expectApi('plan unknown insight', 'POST', '/api/insights/plan', { id: 'nope', on: true }, rejected(404));
  await expectApi('plan missing flag', 'POST', '/api/insights/plan', { id: 'ev-peak' }, rejected(400));
  await expectApi('charging nonsense', 'POST', '/api/charging', { active: true, kwh: -5, readyBy: 99 }, rejected(400));
  await expectApi('charging valid', 'POST', '/api/charging', { active: true, kwh: 24, readyBy: 7 }, noContent);
  await expectApi('contact bad email', 'POST', '/api/contact', { email: 'not-an-email', phone: '+31 6 1234 5678' }, rejected(400));
  await expectApi('contact short phone', 'POST', '/api/contact', { email: 'a@b.nl', phone: '12' }, rejected(400));
  await expectApi('contact valid', 'POST', '/api/contact', { email: 'olivia.test@example.com', phone: '+31 6 1111 2222' }, noContent);
  await expectApi('contact persisted', 'GET', '/api/customer', undefined, ok((j) => j.customer.email === 'olivia.test@example.com'));
  await expectApi('read unknown message', 'POST', '/api/messages/nope/read', {}, rejected(404));
  await expectApi('read all', 'POST', '/api/messages/read-all', {}, noContent);
  await expectApi('activity unknown kind', 'POST', '/api/activity', { kind: 'hack' }, rejected(400));
  await expectApi('assistant without context', 'POST', '/api/assistant', { question: 'hi' }, rejected(400));
  await expectApi('assistant bad language', 'POST', '/api/assistant', { question: 'hi', context: { lang: 'xx' }, conversationId: 'audit' }, rejected(400));
  await expectApi('assistant question', 'POST', '/api/assistant', { question: 'What is my current monthly installment?', context: { lang: 'en', route: '/' }, conversationId: 'audit' }, (r) => (r.status !== 200 || !JSON.stringify(r.json).includes('198') ? 'expected an answer that mentions the installment' : null));
  // staff writes
  await expectApi('staff message bad icon', 'POST', '/api/staff/messages', { title: { en: 'a', nl: 'a' }, body: { en: 'b', nl: 'b' }, icon: 'skull', push: false }, rejected(400));
  await expectApi('staff message missing body', 'POST', '/api/staff/messages', { title: { en: 'a', nl: 'a' }, push: false }, rejected(400));
  await expectApi('cancel unknown outbox item', 'POST', '/api/staff/outbox/nope/cancel', {}, rejected(404, 400));
  await expectApi('staff assistant empty', 'POST', '/api/staff/assistant', { question: '' }, rejected(400));
  // transport
  await expectApi('malformed JSON', 'POST', '/api/installment', undefined, rejected(400), '{"amount": ');
  await expectApi('JSON that is not an object', 'POST', '/api/installment', undefined, rejected(400), '[1,2,3]');
  await expectApi('oversized body', 'POST', '/api/contact', undefined, rejected(413), JSON.stringify({ email: 'a@b.nl', phone: 'x'.repeat(80000) }));
  await expectApi('wrong method', 'GET', '/api/installment', undefined, rejected(405));
  await expectApi('unknown API path', 'GET', '/api/does-not-exist', undefined, (r) => (r.status !== 404 ? 'expected 404' : null));

  // ---- Part 4: security
  console.log('\n--- security');
  const sec = async (name, fn) => { stats.security++; try { const problem = await fn(); if (problem) note(problem.sev ?? 'MEDIUM', 'security', name, problem.what ?? problem); else stats.securityPass++; } catch (e) { note('MEDIUM', 'security', name, `check threw: ${String(e.message).slice(0, 120)}`); } };
  for (const path of ['/..%2f..%2fpackage.json', '/assets/..%2f..%2fserver%2findex.ts', '/%2e%2e/%2e%2e/package.json', '/assets/../../.catalystrc', '/.env', '/server/store.ts', '/package.json', '/.git/config'])
    await sec(`no source or config files served: ${path}`, async () => { const r = await fetch(BASE + path); const t = await r.text(); return /"dependencies"|import type|\[core\]|VAPID|"projects"/.test(t) ? { sev: 'CRITICAL', what: `served internal file content (status ${r.status})` } : null; });
  await sec('malformed percent-encoding does not break the server', async () => { const r = await fetch(BASE + '/%E0%A4%A').catch(() => null); const h = await api('GET', '/api/health'); return !r ? { sev: 'HIGH', what: 'connection dropped on a malformed URL' } : r.status >= 500 ? { sev: 'MEDIUM', what: `status ${r.status} on a malformed URL (should be 400)` } : h.status !== 200 ? { sev: 'CRITICAL', what: 'server stopped answering after a malformed URL' } : null; });
  await sec('malformed encoding in an API path', async () => { const r = await fetch(BASE + '/api/messages/%E0%A4%A/read', { method: 'POST' }).catch(() => null); return !r ? { sev: 'HIGH', what: 'connection dropped' } : r.status >= 500 ? { sev: 'MEDIUM', what: `status ${r.status} (should be 400)` } : null; });
  const page = await api('GET', '/app/login');
  const need = { 'x-content-type-options': /nosniff/i, 'referrer-policy': /./, 'content-security-policy': /./ };
  for (const [h, re] of Object.entries(need)) await sec(`response header ${h}`, async () => (re.test(page.headers.get(h) ?? '') ? null : { sev: 'LOW', what: 'header not set on pages' }));
  await sec('API responses are not cached', async () => { const r = await api('GET', '/api/customer'); return /no-store/.test(r.headers.get('cache-control') ?? '') ? null : { sev: 'LOW', what: 'customer data may be cached' }; });
  await sec('API responses declare nosniff', async () => { const r = await api('GET', '/api/customer'); return /nosniff/i.test(r.headers.get('x-content-type-options') ?? '') ? null : { sev: 'LOW', what: 'header not set on API responses' }; });
  // Script injection: a staff message with markup must show as text in the customer app.
  await sec('markup in a staff message is shown as text, not run', async () => {
    const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    const r = await api('POST', '/api/staff/messages', { title: { en: payload, nl: payload }, body: { en: payload, nl: payload }, icon: 'bell', push: false });
    if (r.status !== 200) return { sev: 'LOW', what: `could not send the test message (status ${r.status})` };
    const b = await chromium.launch({ channel: 'chrome' });
    const c = await b.newContext({ viewport: { width: 390, height: 844 } });
    await c.addInitScript((s) => { localStorage.setItem('engie-demo-lang', 'en'); localStorage.setItem('engie-demo-session', s); sessionStorage.setItem('engie-demo-started', '1'); }, SESSION);
    const pg = await c.newPage();
    await pg.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await pg.getByRole('button', { name: /Notifications/ }).click();
    await pg.waitForTimeout(600);
    const ran = await pg.evaluate(() => window.__xss === 1);
    const shown = await pg.locator('.popover').innerText();
    const st = await c.newPage();
    await st.goto(BASE + '/staff/messages', { waitUntil: 'networkidle' });
    await st.waitForTimeout(800);
    const ranStaff = await st.evaluate(() => window.__xss === 1);
    await b.close();
    return ran || ranStaff ? { sev: 'CRITICAL', what: 'injected script ran' } : !shown.includes('<img') ? { sev: 'LOW', what: 'the message text was not shown literally' } : null;
  });

  await api('POST', '/api/demo/reset', {});
  const avg = stats.loadMs.length ? Math.round(stats.loadMs.reduce((a, b) => a + b, 0) / stats.loadMs.length) : 0;
  const max = Math.max(0, ...stats.loadMs);
  const summary = { base: BASE, at: new Date().toISOString(), pages: stats.pages, pageChecks: stats.pageChecks, links: stats.links, api: `${stats.apiPass}/${stats.api}`, security: `${stats.securityPass}/${stats.security}`, avgLoadMs: avg, maxLoadMs: max, findings: findings.length, bySeverity: findings.reduce((m, f) => ((m[f.severity] = (m[f.severity] ?? 0) + 1), m), {}) };
  fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify({ summary, findings }, null, 2));
  console.log('\n=== summary ===\n' + JSON.stringify(summary, null, 2));
})().catch((e) => { console.error('AUDIT CRASHED', e); process.exit(1); });
