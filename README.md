# ENGIE Netherlands: Customer Experience Portal & AI Assistant (prototype)

Interactive demo of an ENGIE-style customer portal (MijnENGIE) with Eva, a scripted AI support assistant, Net2Grid-powered smart energy features, and an ENGIE staff app linked to it live.

> **Demo only.** Fictional customer ("Sanne de Vries"), sample data, scripted assistant. Not connected to any ENGIE system or AI backend, and nothing is deployed to engie.nl.

## Run

**Windows, easiest:** double-click `start-demo.cmd`. It installs, builds, starts everything on one port and opens http://localhost:3000/start.

By hand (Node.js 22.13+):

```bash
npm install
npm run dev          # everything on http://localhost:3000 with hot reload (start page: /start)
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

## Screens

| Route | Screen |
|---|---|
| `/` | Home dashboard: greeting, KPIs, energy overview chart, contract, quick actions, smart insights, live power |
| `/energy` | Consumption analytics: hour/day/week/month, electricity/gas, comparisons, Net2Grid appliance breakdown, peak/off-peak, trend + table |
| `/billing` | Bills & payments: installment, outstanding, annual overview, invoices (view/download), payment history, adjust installment (`?adjust=1`) |
| `/insights` | Energy insights: savings, alerts, tips, savings plan, benchmark |
| `/smart-energy` | Smart Energy / Net2Grid: live power, recognised appliances, 15-minute smart EV charging planner with CO₂, anomaly detection, capabilities |
| `/assistant` | Full-page Eva (shares the session with the floating chat button) |
| `/account` | Profile, contract, payment details, meter readings, preferences (language, theme) |
| `/mobile-preview` | Phone frame showing the live app at 390 × 844, plus a QR code to open it on a real phone |

The NL/EN switch translates the portal and the assistant. The sun/moon button switches light/dark (remembered).

## Presenting

Press **Shift+P** (or open `/?presenter=1`) for the presenter bar. It walks through the six-step script below and remembers where you are.

| Key | Action |
|---|---|
| N or → | Next step |
| B or ← | Previous step |
| 1–6 | Jump to a step |
| R | Reset the demo (chat, state, back to step 1) |
| Esc | Hide the bar (when no dialog or chat is open) |

1. **Customer dashboard**: KPIs, chart filters, notifications.
2. **Usage analytics**: Hour view with the dynamic price; EV charging in purple; +12% insight.
3. **Bills & installment**: opens the installment dialog; drag to €198; download an invoice.
4. **AI assistant**: asks "Why is my energy bill higher this month?". Follow up with "and last month?" or "why was December higher?".
5. **Net2Grid smart energy**: live power, recognised EV, smart charging in 15-minute blocks.
6. **Mobile experience**: tap through the phone; scan the QR code with a real phone on the same Wi-Fi.

## Architecture

```
src/
  brand.ts        brand name, portal name, assistant name, partners: the only place they're written
  data/           mock data (customer, energy, billing, insights): replace with API calls
  assistant/      scripted assistant
    nlu.ts          normalise (EN/NL, typos), entities (months, "last month"), weighted intent scoring, follow-ups
    intents.ts      intent definitions + suggestion phrases
    answers.ts      pure answer functions from the demo data
    mockProvider.ts AssistantProvider = matchIntent + answerFor
    ChatPanel.tsx   chat UI shared by the floating chat and the full page
  lib/            i18n, demo clock (Amsterdam time), theme, presenter script, charging planner, live power
  components/     layout, UI kit, charts, presenter bar, phone QR
  pages/          one file per screen
tests/e2e/        Playwright specs
```

### Plugging in a real AI backend

`src/assistant/types.ts` defines `AssistantProvider` (`reply(history, context)` and `suggestions(context)`). Implement it with a call to a backend that runs the LLM with tools for usage, billing and contract data, then swap the provider in `PortalAssistant.tsx` (today it is `HttpAssistantProvider`, which calls the server). Replies can carry `facts`, `chart`, `actions` and `followUps`, so the UI stays the same. `context.lastIntent` is echoed back for follow-ups. Set `isMock = false` to replace the "demo assistant" disclaimer.

### What is simulated

- All customer, usage, invoice and payment data (`src/data/*`), on a fixed demo clock: Monday 16 November 2026, 14:20 Amsterdam time.
- Net2Grid appliance recognition, anomaly detection and the live power stream (`src/lib/live.ts`).
- Day-ahead prices (quarter-hour values interpolated from hourly sample prices) and grid CO₂ intensity (illustrative).
- Assistant answers: deterministic intent matching, no model or network calls.
- Invoice download produces a demo HTML document, not a real PDF.
- Installment changes, contact edits, preferences and smart-charging schedules are kept in page state only.
- Sign-out and bank-account changes are disabled (toast message).
