# ENGIE360: ENGIE Netherlands CX demo

PowerConnect.AI concept demo for ENGIE Netherlands: a MijnENGIE-style customer portal with Eva (a scripted AI assistant) and Net2Grid smart-energy features, plus an ENGIE staff app (`/staff`) linked to it live. One Node server runs everything on one port (:3000): API, SQLite database, live events, web push, the frontend and a start page at `/`. Like Hydro Mobile360: the portal lives under `/app` (router basename; routes inside stay short, e.g. `/energy`), the staff app at `/staff`; `src/main.tsx` picks the app and moves old portal links under `/app`. All data is sample data. **It is built and working**; changes from here are iterations. Read `README.md` for screens and the demo script, `DEPLOY.md` for running and hosting, and `PLAN.md` for how it was built.

Sister project: `E:\hydro-one-ev-demo` (Hydro One). ENGIE360 borrows how that demo *works* (one server, live staff side, push, start page, Catalyst hosting), never its content. The assistant NLU, presenter mode, lint rules and test setup follow its patterns; look there before inventing something new.

## Layout

- `shared/contract.ts`: REST paths, request/response types and live (SSE) events. The only link between `src/` and `server/`.
- `server/`: `index.ts` (listens first, then loads), `app.ts` (API + Vite middleware in dev, `dist/` in prod), `routes.ts`, `store.ts` (demo state and operations, seeded from `src/data`), `db.ts` (node:sqlite JSON docs), `live.ts` (SSE hub), `push.ts` (web-push/VAPID), `startPage.ts`, `static.ts`.
- `src/brand.ts`: brand name, portal, assistant (`Eva`), partner names. Never hard-code "ENGIE", "MijnENGIE", "Eva", "Net2Grid" or "Stedin" elsewhere.
- `src/data/*`: seed/mock data, also used by the server. `src/lib/time.ts` holds the demo clock (`DEMO_NOW`, `DEMO_TZ` = Europe/Amsterdam). Use `zoned()` / `dayKey()`; never `getHours()` / `setDate()` on local time.
- `src/api/`: API client, `LiveProvider` (server state + SSE, falls back to local data without a server), `httpAssistant.ts` (Eva via the server), `push.ts`.
- `src/assistant/`: `nlu.ts` (pure matcher) → `intents.ts` (definitions, phrases, suggestions) → `answers.ts` (pure answers) → `mockProvider.ts`. UI in `ChatPanel.tsx`; portal session in `PortalAssistant.tsx` + `portalContext.ts`.
- `src/components/RailShell.tsx`: the shared Hydro-style shell (top bar, hover-widening icon rail, phone drawer) used by the portal (`Layout.tsx`) and the staff app; `ThemeMenu.tsx` (Dark/Light/Match system).
- `src/staff/`: the staff app. `src/pages/`: portal screens and the mobile preview. `public/sw.js`: push service worker.
- `src/lib/`: i18n, theme, presenter script (6 steps), charging planner, live power simulation. `src/components/`: layout, UI kit, toasts, nav, charts, presenter bar, phone QR.
- Tests: Vitest `src/**/*.spec.ts` and `server/**/*.spec.ts`; Playwright `tests/e2e/` (starts its own full server on :5190).

## Rules

- Eva is scripted on purpose: no LLM or network calls beyond our own server, and the "demo" disclosure always shows. New questions = keywords/intent in `intents.ts`, an answer in `answers.ts`, specs in `nlu.spec.ts` / `answers.spec.ts`. Every suggestion phrase must round-trip to its intent. Prefix exact-only keywords with `=` (`'=auto'` must not match "automatische").
- Contract changes go in `shared/contract.ts` first, then server and client.
- Every user-visible string is bilingual: `t('English', 'Nederlands')` in components, `{ en, nl }` (`Text`) in data.
- Colours come from the CSS tokens in `src/styles/global.css`; each has a light and a dark value (`:root[data-theme='dark']`). `--navy` is brand navy for surfaces, `--ink` is text. Charts take colours from `useTheme().chart`. Lato is bundled (`@fontsource/lato`); no external font or CDN requests.
- External systems are simulated and labelled as sample data. No real customer, payment or ID data.
- TypeScript strict; touch targets ≥ 44 px; accessibility labels on icon-only buttons; no horizontal scroll at 390 px.
- Lint: ESLint flat config with React Compiler rules: no synchronous `setState` in an effect, no ref writes/reads during render, and a `.tsx` that exports a component exports nothing else.
- Hosting constraints the server relies on (keep them): open the port before loading anything (Catalyst kills apps not listening within 10 s); port from `X_ZOHO_CATALYST_LISTEN_PORT`, then `PORT`, then 3000; SSE streams end at 25 s on Catalyst (30 s proxy limit); one instance only.
- After changes: `npm run check` (typecheck + lint + unit tests), then `npm run e2e`.

## Commands

- `npm run dev`: everything on http://localhost:3000 with hot reload (start page at `/`). `start-demo.cmd`: install + build + start for Windows.
- `npm run build` / `npm start`: production on :3000. `npm run deploy:catalyst`: Docker image to Zoho Catalyst AppSail.
- Demo day: Shift+P for the presenter bar (N/B/1–6/R/Esc). Phone push needs HTTPS (hosted URL) or localhost.
- Use npm (global pnpm is broken on this machine). Port 5173 is often taken by another app; the server uses 3000.
