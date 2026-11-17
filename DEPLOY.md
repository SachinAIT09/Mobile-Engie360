# Running and hosting ENGIE360

One server process serves everything on one port:

| Path | What |
|---|---|
| `/` | Start page: links to both apps, the phone QR code, the demo script, Reset demo |
| `/app` | Customer app (MijnENGIE): sign in as `olivia.carter@example.com`, any password |
| `/staff` | Staff app (ENGIE Customer Service): dashboard, activity, Eva conversations, messages, Demo control panel |
| `/api/...` | API; live updates at `/api/events` (Server-Sent Events) |

Data lives in a SQLite file (Node's built-in `node:sqlite`, nothing to install). **Reset demo** (start page, staff app, or presenter bar `R`) restores the starting state.

## On a laptop (Windows)

Double-click **`start-demo.cmd`**. It installs, builds and starts, then opens http://localhost:3000. Keep the window open; close it to stop.

Or by hand (Node.js 22.13+):

```bash
npm install
npm run build
npm start            # production on :3000
npm run dev          # development on :3000 with hot reload
```

The start page's QR code points at this laptop's Wi-Fi address, so a phone on the same Wi-Fi can open the portal.

**Phone push needs HTTPS** (browsers only allow push on secure pages, except `localhost`). On the laptop, push works at `localhost`. For push on a real phone, use a hosted URL (Docker behind HTTPS, or Catalyst). On iPhone the portal must also be added to the home screen first (Safari → Share → Add to Home Screen).

## Option A: Docker

```bash
docker compose up -d --build        # http://<server>:3000
```

Settings (environment variables, all optional):

| Variable | Use |
|---|---|
| `APP_PORT` | Host port (default 3000) |
| `PUBLIC_URL` | Public address, e.g. `https://engie360.example.com`; the QR code uses it |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Fixed push keys. Without them, keys are generated once and stored with the data |
| `DATA_DIR` | Where the SQLite file lives (compose uses a volume, so data survives restarts) |

Generate a VAPID key pair once with `npx web-push generate-vapid-keys`.

## Option B: Zoho Catalyst AppSail

AppSail runs the same Docker image with an HTTPS URL, so phone push works there.

One-time setup:

```powershell
npm i -g zcatalyst-cli
catalyst login          # Zoho account (India DC: zoho.in)
catalyst init           # in this folder: create a project for ENGIE360
```

Deploy (Docker Desktop running):

```powershell
npm run deploy:catalyst              # build + deploy
npm run deploy:catalyst -- -SkipBuild
```

Then, in the Catalyst console (AppSail → engie360 → Configuration), set `PUBLIC_URL` to the service URL and the two `VAPID_*` keys. Without fixed keys, each cold start makes new ones and phones have to re-enable notifications.

Check the hosted site after a deploy (both run in a real browser against the address you give):

```powershell
npm run audit:site -- https://<service>.development.catalystappsail.in .audit-out   # every screen at five sizes, API, security
$env:BASE_URL = "https://<service>.development.catalystappsail.in"; npm run e2e      # the browser suite
```

Both reset the demo data on the server they test.

Catalyst adds `X-Frame-Options: DENY` to every response. The customer app's phone column on a laptop is an iframe of the app itself; it works because pages send `Content-Security-Policy: frame-ancestors 'self'`, which browsers follow instead (`server/http.ts`). If the column is ever blocked anyway, the app shows itself without the column.

What to expect on AppSail:
- **Data resets when the service sleeps** (after ~5 minutes without traffic): the SQLite file is on the instance's temporary disk. That suits a demo; the next visit shows "Starting the demo…" for a few seconds.
- **Fast start:** the server opens its port before loading anything (AppSail requires 10 s); it's ready in about 4 s.
- **Live updates use plain HTTP** (Server-Sent Events). AppSail cuts requests at 30 s, so streams end at 25 s and the browser reconnects automatically.
- **Networks that hold streams back:** some antivirus web filters and company proxies deliver a streamed response only when it ends, which would delay live updates by up to 25 s. The app notices (the stream does not open within 4 s), switches to streams of a few seconds (`/api/events?short=1`) and the server replays anything missed in between, so updates still arrive within about 3 s.
- **One instance only:** live sync is in-process. Keep the service at one instance.
