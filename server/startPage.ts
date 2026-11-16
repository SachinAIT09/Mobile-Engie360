import QRCode from 'qrcode';
import { brand } from '../src/brand';
import { customer } from '../src/data/customer';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const VENDOR = 'PowerConnect.AI';

/** Lato weights the start page uses, served from the bundled @fontsource package (see app.ts). */
export const START_FONTS = ['400', '700', '900'] as const;

/**
 * Start page at `/`: the two apps, the phone QR and the demo script (the Hydro Mobile360 layout), in the
 * ENGIE look of the portal: light page, ENGIE blue, navy hero, Lato, ENGIE wordmark. Follows the
 * portal's theme choice (light, dark or system).
 */
export async function startPage(phoneUrl: string, otherUrls: string[]): Promise<string> {
  const qr = await QRCode.toString(phoneUrl, { type: 'svg', margin: 1, color: { dark: '#0b2240', light: '#ffffff' } });
  const lan = phoneUrl.startsWith('http://');
  const reach = lan ? 'The phone must be on the same Wi-Fi as this laptop.' : 'It works on any phone, on Wi-Fi or mobile data.';
  const eva = esc(brand.assistant.name);
  const name = esc(`${customer.firstName} ${customer.lastName}`);
  const fonts = START_FONTS.map((w) => `@font-face{font-family:Lato;font-style:normal;font-weight:${w};font-display:swap;src:url(/fonts/lato-${w}.woff2) format('woff2')}`).join('');

  const app = (href: string, title: string, sub: string, icon: string, primary: boolean) =>
    `<a class="app${primary ? ' pri' : ''}" href="${href}" target="_blank" rel="noopener"><span class="ic" aria-hidden="true">${icon}</span><span class="txt"><strong>${esc(title)}</strong><span>${esc(sub)}</span></span><span class="go" aria-hidden="true">→</span></a>`;
  const svg = (d: string) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const headset = svg('<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>');
  const phone = svg('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand.name)}360 demo</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>(function(){try{var t=localStorage.getItem('engie-demo-theme');if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}})()</script>
<style>
${fonts}
:root{--blue:#00aaff;--blue-600:#0089d1;--blue-700:#006fa8;--blue-50:#e8f6ff;--blue-100:#cdeeff;--green:#23d2b5;--green-50:#e3faf5;--green-700:#0f8f7a;--ink:#0b2240;--ink-2:#33475e;--muted:#64758b;--line:#e3e9f0;--line-2:#eef2f6;--bg:#f4f7fa;--surface:#fff;--navy:#0b2240;--shadow:0 1px 2px rgba(11,34,64,.05),0 6px 20px rgba(11,34,64,.06);--logo:url(/brand/powerconnect-logo-trimmed.png)}
:root[data-theme=dark]{color-scheme:dark;--blue-700:#5cc8ff;--blue-50:#0f2a42;--blue-100:#17436a;--green-50:#0f2f2b;--green-700:#4fe0c4;--ink:#e8eef6;--ink-2:#c3cfdd;--muted:#8fa1b8;--line:#24374f;--line-2:#1b2b41;--bg:#0a1524;--surface:#111f33;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25);--logo:url(/brand/powerconnect-logo-white.png)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:Lato,'Segoe UI',system-ui,sans-serif;font-size:15px;line-height:1.5;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
a{color:var(--blue-700);text-decoration:none}a:focus-visible,button:focus-visible{outline:3px solid rgba(0,170,255,.45);outline-offset:2px;border-radius:8px}
.top{height:68px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center}
.in{max-width:960px;width:100%;margin:0 auto;padding:0 24px}
.top .in{display:flex;align-items:center;gap:12px}
.mark{font-weight:900;font-size:26px;letter-spacing:.04em;color:var(--blue);position:relative;line-height:1}
.mark::before{content:'';position:absolute;left:-2px;right:-2px;top:-8px;height:9px;border-top:3px solid var(--blue);border-radius:50% 50% 0 0}
.sub{font-size:12.5px;font-weight:700;color:var(--muted);border-left:1px solid var(--line);padding-left:12px}
.by{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.by i{display:block;width:118px;height:26px;background:var(--logo) left center/contain no-repeat}
.hero{background:linear-gradient(120deg,#0b2240 0%,#0d3561 55%,#005e94 100%);color:#fff;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;right:-140px;top:-160px;width:420px;height:420px;border-radius:50%;border:46px solid rgba(0,170,255,.18)}
.hero .in{position:relative;z-index:1;padding-top:36px;padding-bottom:40px}
.eyebrow{display:inline-block;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#7fd5ff;margin-bottom:8px}
h1{margin:0;font-size:34px;font-weight:900;letter-spacing:-.01em;line-height:1.15}
.hero p{margin:8px 0 0;max-width:640px;color:rgba(255,255,255,.8)}
main{max-width:960px;margin:-22px auto 0;padding:0 24px 32px;display:flex;flex-direction:column;gap:18px;position:relative;z-index:2}
.apps{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.app{display:flex;align-items:center;gap:16px;padding:20px 22px;border-radius:20px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow);color:var(--ink);min-height:44px;transition:border-color .15s,transform .15s,box-shadow .15s}
.app:hover{border-color:var(--blue-100);transform:translateY(-2px)}
.app .ic{flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:var(--blue-50);color:var(--blue-700)}
.app .txt{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.app strong{font-size:17px;font-weight:900}.app .txt span{font-size:14px;color:var(--muted)}
.app .go{font-size:20px;font-weight:900;color:var(--blue)}
.app.pri{background:var(--blue);border-color:var(--blue);color:#fff}
.app.pri .ic{background:rgba(255,255,255,.2);color:#fff}.app.pri .txt span{color:rgba(255,255,255,.9)}.app.pri .go{color:#fff}
.app.pri:hover{background:var(--blue-600);border-color:var(--blue-600);box-shadow:0 10px 24px rgba(0,170,255,.3)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:var(--shadow)}
.phone{display:flex;flex-wrap:wrap;gap:22px;align-items:center}
.phone svg{width:176px;height:176px;background:#fff;border-radius:14px;padding:8px;border:1px solid var(--line)}
.phone .txt{flex:1 1 280px;display:flex;flex-direction:column;gap:6px}
h2{margin:0;font-size:17px;font-weight:900}
code,kbd{background:var(--line-2);border:1px solid var(--line);padding:1px 7px;border-radius:7px;font-size:13px;color:var(--ink)}
code{font-family:ui-monospace,Consolas,monospace;word-break:break-all;color:var(--blue-700)}kbd{font-family:inherit;font-weight:900}
.muted{color:var(--muted);font-size:13px}
ol{margin:12px 0 0;padding:0;list-style:none;counter-reset:s;display:flex;flex-direction:column;gap:12px}
ol li{counter-increment:s;display:grid;grid-template-columns:30px 1fr;gap:12px;align-items:start}
ol li::before{content:counter(s);width:30px;height:30px;border-radius:50%;background:var(--blue-50);color:var(--blue-700);font-weight:900;font-size:14px;display:grid;place-items:center}
strong{font-weight:900}
.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid var(--line-2)}
button{font:inherit;font-weight:700;font-size:14px;border:0;border-radius:999px;padding:0 20px;min-height:44px;background:var(--navy);color:#fff;cursor:pointer}
:root[data-theme=dark] button{background:var(--blue)}
button:hover{filter:brightness(1.1)}
.links{display:flex;gap:16px;flex-wrap:wrap;font-weight:700;font-size:14px}
footer{max-width:960px;margin:0 auto;padding:0 24px 32px;font-size:12.5px;color:var(--muted)}
.flag{display:inline-flex;align-items:center;gap:6px;border:1px dashed var(--line);padding:3px 10px;border-radius:999px}
@media(max-width:600px){h1{font-size:27px}.by span{display:none}.sub{display:none}.phone svg{width:150px;height:150px}}
</style></head><body>
<header class="top"><div class="in"><span class="mark">${esc(brand.name)}</span><span class="sub">${esc(brand.name)}360 demo</span><span class="by"><span>Concept by</span><i role="img" aria-label="${VENDOR}"></i></span></div></header>
<section class="hero"><div class="in">
<span class="eyebrow">${esc(brand.portal)} · ${esc(brand.country)}</span>
<h1>${esc(brand.name)}360 demo</h1>
<p>${VENDOR} concept for ${esc(brand.name)} ${esc(brand.country)}. Open the two apps in separate tabs, or the customer app on a phone. Everything stays in sync through this server.</p>
</div></section>
<main>
<div class="apps">
${app('/staff', 'Staff app', `${brand.name} Customer Service: dashboard, live customer activity, ${brand.assistant.name} conversations, messages and the demo control panel.`, headset, true)}
${app('/app', 'Customer app', `The ${brand.portal} app. Sign in as ${customer.email} (any password). Best on a phone.`, phone, false)}
</div>
<section class="card phone">${qr}<div class="txt"><h2>Open the customer app on a phone</h2>
<span>Scan with the phone camera, or open <code>${esc(phoneUrl)}</code>. ${reach}</span>
${otherUrls.length ? `<span class="muted">Other addresses for this laptop: ${otherUrls.map(esc).join(', ')}</span>` : ''}
<span class="muted">Phone notifications need HTTPS (a hosted URL); on this laptop they work at localhost.</span></div></section>
<section class="card"><h2>Demo script</h2>
<ol>
<li><span>Open the <strong>Staff app</strong> on the laptop and the <strong>Customer app</strong> on a phone (scan the code), and sign in as ${name}. The staff dashboard shows she is in the app.</span></li>
<li><span><strong>Customer activity:</strong> on the phone, <em>Billing</em> → <em>Adjust installment</em> → €198 → Confirm. It appears in the staff app’s <em>Customer activity</em> at once.</span></li>
<li><span><strong>${eva}:</strong> on the phone, tap the ${eva} button → “Why is my energy bill higher this month?”, then “and last month?”. Staff read along under <em>${eva} conversations</em>.</span></li>
<li><span><strong>Send to phone:</strong> Staff app → <em>Demo control panel</em> → <em>Cheapest hours tonight</em>. A banner pops up in the app, and a notification if it is on (<em>Profile</em> → <em>Preferences</em>).</span></li>
<li><span><strong>Presenter:</strong> press <kbd>Shift</kbd>+<kbd>P</kbd> in the staff app for the step-by-step bar (<kbd>N</kbd> next, <kbd>R</kbd> reset).</span></li>
</ol>
<div class="row"><button id="reset" type="button">Reset demo</button><span id="msg" class="muted" role="status"></span>
<span class="links" style="margin-left:auto"><a href="/staff/demo">Demo control panel</a><a href="/staff/preview">Phone preview</a></span></div></section>
</main>
<footer><span class="flag">Sample data · not connected to ${esc(brand.name)} systems</span></footer>
<script>
document.getElementById('reset').onclick=async()=>{const m=document.getElementById('msg');m.textContent='Resetting…';const r=await fetch('/api/demo/reset',{method:'POST'});m.textContent=r.ok?'Demo reset.':'Reset failed.';};
</script>
</body></html>`;
}
