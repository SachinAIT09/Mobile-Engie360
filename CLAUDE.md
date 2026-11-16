# ENGIE Netherlands CX prototype

PowerConnect.AI concept demo for ENGIE Netherlands: a MijnENGIE-style customer portal, a scripted AI assistant, Net2Grid smart-energy features, and the same assistant embedded in an engie.nl-style page. Frontend only (Vite + React 19 + TypeScript); everything runs on local mock data. **It is built and working**; changes from here are iterations. Read `README.md` for screens, commands and the demo script.

Sister project: `E:\hydro-one-ev-demo` (Hydro One). The assistant NLU, presenter mode, lint rules and test setup follow its patterns; borrow from there before inventing something new.

## Layout

- `src/brand.ts`: brand name, portal, assistant name, partner names. Never hard-code "ENGIE", "MijnENGIE", "Net2Grid" or "Stedin" elsewhere.
- `src/data/*`: mock data. `src/lib/time.ts` holds the demo clock (`DEMO_NOW`, `DEMO_TZ` = Europe/Amsterdam). Use `zoned()` / `dayKey()`; never `getHours()` / `setDate()` on local time.
- `src/assistant/`: `nlu.ts` (pure matcher) → `intents.ts` (definitions, phrases, suggestions) → `answers.ts` (pure answers) → `mockProvider.ts` (the `AssistantProvider`). UI in `ChatPanel.tsx`; portal session in `PortalAssistant.tsx` + `portalContext.ts`.
- `src/widget/`: the embeddable website widget (`EngieAssistantWidget.tsx`) and `mount.tsx`.
- `src/lib/`: i18n (`i18n.ts` hook + `I18nProvider.tsx`), theme (`theme.ts` + `ThemeProvider.tsx`), presenter script (`presenter.ts`), charging planner (`chargingPlan.ts`), live power simulation (`live.ts`).
- `src/components/`: layout, UI kit (`ui.tsx`), toasts (`toast.ts`), nav items (`nav.ts`), charts, `PresenterBar.tsx`, `PhoneQr.tsx`.
- `tests/e2e/`: Playwright specs; `src/**/*.spec.ts`: Vitest unit tests.

## Rules

- The assistant is scripted on purpose: no LLM or network calls, and the "demo assistant" disclosure always shows. New questions = a new intent or keywords in `intents.ts`, an answer in `answers.ts`, and specs in `nlu.spec.ts` / `answers.spec.ts`. Every suggestion phrase must round-trip to its intent (spec enforces it). Prefix exact-only keywords with `=` (`'=auto'` must not match "automatische").
- Every user-visible string is bilingual: `t('English', 'Nederlands')` in components, `{ en, nl }` (`Text`) in data.
- Colours come from the CSS tokens in `src/styles/global.css`; each token has a light and a dark value (`:root[data-theme='dark']`). `--navy` is the brand navy for surfaces, `--ink` is text. Charts take colours from `useTheme().chart` (SVG attributes can't read CSS variables). The website demo (`.site`) is always light.
- External systems are simulated and labelled as sample data. No real customer, payment or ID data. Nothing touches engie.nl.
- TypeScript strict; touch targets ≥ 44 px; accessibility labels on icon-only buttons; no horizontal scroll at 390 px.
- Lint is ESLint flat config with the React Compiler rules: no `setState` synchronously inside an effect (derive state, or set it in callbacks/promises), no ref writes or reads during render, and a `.tsx` file that exports a component exports nothing else (hooks and constants go in a `.ts` next to it).
- After changes: `npm run check` (typecheck + lint + unit tests), then `npm run e2e`.

## Demo day

- `npm run dev`, open the printed URL. Shift+P for the presenter bar (N/B/1–7/R/Esc).
- `/mobile-preview` shows a QR code with the laptop's LAN address; the phone must be on the same Wi-Fi.
- Port 5173 is often taken on this machine by another app; Vite moves to the next free port.
