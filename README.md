# ENGIE Netherlands: Customer Experience Portal & AI Assistant (prototype)

Interactive demo of an ENGIE-style customer portal (MijnENGIE) with Eva, a scripted AI support assistant, Net2Grid-powered smart energy features, and an ENGIE staff app linked to it live.

> **Demo only.** Fictional customer ("Olivia Carter"), sample data, scripted assistant. Not connected to any ENGIE system or AI backend, and nothing is deployed to engie.nl.

## Run

**Windows, easiest:** double-click `start-demo.cmd`. It installs, builds, starts everything on one port and opens http://localhost:3000 (the start page).

By hand (Node.js 22.13+):

```bash
npm install
npm run dev          # everything on http://localhost:3000 with hot reload
```

| Command | What it does |
|---|---|
| `npm run dev` | One server on :3000: API, live events, push, and the frontend with hot reload |
| `npm run build` / `npm start` | Production build / run it on :3000 (what `start-demo.cmd` and Docker do) |
| `npm run dev:client` | Frontend only (Vite); the app falls back to built-in sample data without the server |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint, zero warnings allowed (React Compiler rules on) |
| `npm test` | Unit tests (Vitest): assistant, charging planner, server store |
| `npm run e2e` | Browser tests (Playwright, installed Chrome): customer + staff flows, desktop + mobile |
| `npm run check` | typecheck + lint + unit tests |
| `npm run deploy:catalyst` | Build the Docker image and deploy to Zoho Catalyst AppSail |

Hosting (Docker, Catalyst, phone push over HTTPS): see [DEPLOY.md](DEPLOY.md).

## Two apps, like Hydro Mobile360

URLs work like the Hydro Mobile360 demo: `/` is the **start page** (both apps, phone QR, demo script, Reset), the **customer app** is under `/app`, and the **staff app** is at `/staff`. Old portal links (`/energy`, `/billing`…) redirect under `/app`.

### Customer app (`/app`): a phone app

Opens on the **MijnENGIE sign-in** (`olivia.carter@example.com` or customer number `2003 418 762`, any password). Bottom tabs **Home · Energy · Eva · Billing · Profile**, with Eva as the raised button in the middle; sub-pages have a back arrow. No demo tools in here.

| Route (under `/app`) | Screen |
|---|---|
| `/login` | Sign-in |
| `/` | Home: greeting with next payment, quick actions, KPIs, installment advice, energy overview, top insight, live power (every customer screen is kept to about two phone screens; a mobile e2e test enforces it) |
| `/energy` | Usage: hour/day/week/month, comparisons, Net2Grid breakdown, peak/off-peak, trend; links to Insights and Smart Energy |
| `/insights` | Energy insights (sub-page of Energy): savings, alerts, tips, savings plan, benchmark |
| `/smart-energy` | Smart Energy / Net2Grid (sub-page of Energy): live power, appliances, 15-minute smart charging with CO₂ |
| `/billing` | Bills & payments: installment (`?adjust=1`), pay an invoice (pay sheet with iDEAL / bank account / card, ending in an animated tick; simulated, recorded on our server only), automatic payment on/off, invoices and payment receipts as PDF downloads (`src/lib/pdf.ts`), payment history, annual overview |
| `/account` | Profile: details, contract, payment, meter readings, preferences (language, theme, phone notifications), sign out |
| `/assistant` | Eva full screen |

### Staff app (`/staff`): ENGIE Customer Service

Top bar (language, theme menu Dark/Light/Match system, live status, avatar) and an icon rail that widens on hover; a drawer on phones.

| Route | Page |
|---|---|
| `/staff` | Dashboard: Olivia's KPIs, details ("in the app now"), latest activity |
| `/staff/customers` | Customer list: 1,248 customers (US names), search, filters, paging |
| `/staff/customers/:id` | Customer page: attention points, cost, usage, visits, timeline, contract and billing, appliances, messages, Eva |
| `/staff/activity` | Customer activity: live table with filters (Account, Billing, Savings & charging, Eva, Messages, Views) |
| `/staff/conversations` | Eva conversations, live |
| `/staff/messages` | Write a message (templates or your own), see sent and read |
| `/staff/reports` | Reports: usage, cost against the installment, appliances, app activity, message delivery, Eva topics; CSV export per card |
| `/staff/assistant` | AI assistant (scripted): questions about the customer, message drafts that open in the composer |
| `/staff/audit` | Audit log: who sent, scheduled or cancelled what, automatic notifications, demo resets; live, with CSV export |
| `/staff/demo` | **Demo control panel**: one-click *Send to phone* cards, phone pairing QR, presenter keys, Reset demo |

## Presenting

The presenter drives the **staff app** on the laptop; the customer app runs on a phone (on a laptop, `/app` shows it as a phone-width column). In the staff app press **Shift+P** for the presenter bar (or open `/staff?presenter=1`).

| Key | Action |
|---|---|
| N or → | Next step |
| B or ← | Previous step |
| 1–5 | Jump to a step |
| R | Reset the demo (back to step 1) |
| Esc | Hide the bar (when no dialog is open) |

1. **Customer at a glance** (Dashboard): Olivia signs in on the phone; the badge shows she is in the app.
2. **Customer activity**: on the phone, Billing → Adjust installment → €198. It appears at once.
3. **Eva conversations**: on the phone, tap Eva → "Why is my energy bill higher this month?" → "and last month?". Read along live.
4. **Send to phone** (Demo control panel): "Cheapest hours tonight" → banner in the app (and a phone notification if on).
5. **Personal message**: write your own; see when Olivia reads it.

## Architecture

```
server/             Node server: API, SQLite (node:sqlite), live events (SSE), web push, start page; one port
shared/contract.ts  REST paths, types, live events shared by server and frontend
src/
  main.tsx, Root.tsx  picks the app: /staff → staff app, everything else → customer app under /app
  brand.ts          brand name, portal name, assistant name, partners: the only place they're written
  data/             seed data (customer, energy, billing, insights), also used by the server
  api/              API client, live provider (server state + SSE), Eva over HTTP, push opt-in
  assistant/        scripted Eva: nlu.ts → intents.ts → answers.ts → mockProvider.ts; ChatPanel.tsx
  pages/            customer app screens (+ Login.tsx); components/Layout.tsx is its phone-app shell
  staff/            staff app: StaffApp.tsx (layout + routes), pages/, parts.tsx, useStaffData.ts
  components/       RailShell (staff shell), ThemeMenu, UI kit, charts, presenter bar, phone QR
  lib/              i18n, demo clock (Amsterdam time), theme, session, presenter script, charging planner
tests/e2e/          Playwright: customer app, staff app, live customer ↔ staff, phone sizes
```

### Plugging in a real AI backend

`src/assistant/types.ts` defines `AssistantProvider` (`reply(history, context)` and `suggestions(context)`). Implement it with a call to a backend that runs the LLM with tools for usage, billing and contract data, then swap the provider in `PortalAssistant.tsx` (today it is `HttpAssistantProvider`, which calls the server). Replies can carry `facts`, `chart`, `actions` and `followUps`, so the UI stays the same. `context.lastIntent` is echoed back for follow-ups. Set `isMock = false` to replace the "demo assistant" disclaimer.

### What is simulated

- All customer, usage, invoice and payment data (`src/data/*`), on a fixed demo clock: Monday 16 November 2026, 14:20 Amsterdam time.
- Net2Grid appliance recognition, anomaly detection and the live power stream (`src/lib/live.ts`).
- Day-ahead prices (quarter-hour values interpolated from hourly sample prices) and grid CO₂ intensity (illustrative).
- Assistant answers: deterministic intent matching, no model or network calls.
- Invoice download produces a demo HTML document, not a real PDF.
- Changes go to the demo server's SQLite file (installment, savings plan, contact details, messages, Eva chats, activity) until **Reset demo**.
- Sign-in accepts the sample customer with any password; bank-account changes are disabled (toast message).
