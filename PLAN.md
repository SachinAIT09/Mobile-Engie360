# ENGIE demo: shared build plan

Both Claude sessions follow this file and only this file. Change it only after you've agreed the change by message, and log it under "Changes".

## Goal

One project in `D:\Mobile Engie360`, built on the **first ENGIE mock-up** (currently `legacy/`). It keeps the mock-up's look, screens and data: Sanne de Vries, Eva, NL/EN, dark theme, presenter mode, website widget, mobile preview. It adds these **Hydro Mobile360 features**, without Hydro's data or screens:

1. **Backend API + database.** The mock data moves behind an API. Data survives refreshes; "Reset demo" restores it.
2. **Staff app at `/staff`, linked live.** An ENGIE customer-service view that sees Sanne's activity as it happens and can message her.
3. **Real phone push.** Staff messages pop up on a real phone (web push).
4. **Run like Hydro.** Everything on one port (`localhost:3000`): a start page with links and a phone QR, `start-demo.cmd`, Docker, and Zoho Catalyst hosting.

## ENGIE360 is not Hydro Mobile360

They are two different products. ENGIE360 borrows only **how** Hydro Mobile360 works (an API behind the app, a staff side linked live, real phone push, one-command run and hosting). It takes **nothing** of its content:

- No Hydro One branding, colours, wording, screens or flows (no feeders, DR programs, EV-detection enrollment, Campaign 360, Kubra, CAD).
- No Hydro code copied as-is. Patterns may be reused (boot gate, SSE/socket approach, push setup, deploy script), rewritten for ENGIE.
- The staff app is ENGIE's own customer-service view of Sanne's account, designed in the mock-up's style. It is not Hydro's staff dashboard.
- Everything a user sees comes from the ENGIE mock-up: its theme, its data, Eva, NL/EN.

## Target layout

```
D:\Mobile Engie360
  src/              frontend (the mock-up): customer portal, website demo, mobile preview, + staff app at /staff
  shared/           contract.ts: types, REST paths, live event names (used by src/ and server/)
  server/           Node server: API, node:sqlite database, live updates (SSE), web-push, serves dist/ + start page
  tests/e2e/        Playwright, both apps
  Dockerfile, docker-compose.yml, start-demo.cmd, scripts/deploy-catalyst.ps1
  package.json      one npm package: `npm run dev`, `npm run build`, `npm start` (:3000)
```

## Owners (disjoint folders, never edit the other's)

| Area | Owner |
|---|---|
| Step 0 (repo reset) | **mobile-engie360-4d** |
| `shared/contract.ts` | **mobile-engie360-f4** writes it first; changes are agreed by message |
| `server/`, Docker, `start-demo.cmd`, Catalyst script, start page | **mobile-engie360-f4** |
| `src/` (customer app wired to the API, staff app, push opt-in, service worker) | **mobile-engie360-4d** |
| `tests/e2e/` | **mobile-engie360-f4** (at the end, both apps) |
| `package.json` scripts/deps | either, by message first |

## Steps

0. **[4d]** Commit the current Hydro rebuild to branch `hydro-rebuild`. On `master`: move `legacy/*` back to the root, remove `apps/` and `packages/`, commit "Restore ENGIE mock-up as the project". Message f4 "step 0 done".
1. **[f4]** Write `shared/contract.ts` and the API sketch below. Message 4d.
2. **In parallel:**
   - **[f4]** `server/`: API + DB seeded from the mock-up data; SSE `/api/events`; `/api/push/*` (VAPID); Reset; serves `dist/` and the start page on :3000; Catalyst-safe boot (listen first).
   - **[4d]** `src/`: API client + hooks replacing `src/data` imports (falling back to local data while the server is not up); staff app at `/staff`; live updates; push opt-in and `public/sw.js`.
3. **[f4]** Docker, `start-demo.cmd`, Catalyst deploy script.
4. **[both]** `npm run check` green on each side. **[f4]** e2e across both apps, then one final run together.

## API sketch (finalised in `shared/contract.ts`)

- `GET /api/customer` · `GET /api/energy?period=` · `GET /api/billing` · `GET /api/insights`
- `POST /api/installment {amount}` · `POST /api/assistant {question, context}` (scripted Eva, server-side)
- `GET /api/messages` · `POST /api/staff/messages {title, body, push}` · `GET /api/staff/activity`
- `POST /api/push/subscribe` · `GET /api/push/key` · `POST /api/demo/reset`
- `GET /api/events` (SSE): `activity`, `message:new`, `installment:changed`, `chat:message`, `demo:reset`

## Rules

- npm, not pnpm. TypeScript strict. `npm run check` (typecheck + lint + unit tests) before saying "done".
- Commit only your own paths. Never `git add -A`, reset, checkout, stash or clean on the shared tree.
- Keep the mock-up's tokens and data; anything new is bilingual (NL/EN) and works in dark mode.
- The assistant stays scripted (no LLM). Everything is sample data; nothing touches ENGIE systems.

## Status

- [x] 0 repo reset (4d)
- [x] 1 contract (f4)
- [ ] 2a server (f4) · [ ] 2b frontend + staff app (4d)
- [ ] 3 run/hosting (f4)
- [ ] 4 checks + e2e (both)

## Changes

- f4: `tsconfig.json` now includes `shared/` and `server/` and sets `allowImportingTsExtensions` (server runs TS directly).
- f4: contract adds the two endpoints 4d asked for: `banner` on `message:new`, and `GET /api/staff/conversations` + live `chat:message`.
