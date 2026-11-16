import QRCode from 'qrcode';
import { brand } from '../src/brand';
import { customer } from '../src/data/customer';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const VENDOR = 'PowerConnect.AI';

/**
 * Start page at `/`, in the same style as the Hydro Mobile360 start page: the two apps, the phone QR and the
 * demo script. ENGIE content only; PowerConnect.AI is the vendor shown in the header.
 */
export async function startPage(phoneUrl: string, otherUrls: string[]): Promise<string> {
  const qr = await QRCode.toString(phoneUrl, { type: 'svg', margin: 1, color: { dark: '#0b1b45', light: '#ffffff' } });
  const lan = phoneUrl.startsWith('http://');
  const reach = lan
    ? 'The phone must be on the same Wi-Fi as this laptop.'
    : 'It works on any phone, on Wi-Fi or mobile data.';
  const card = (href: string, title: string, sub: string, primary: boolean) =>
    `<a class="card${primary ? ' pri' : ''}" href="${href}" target="_blank" rel="noopener"><strong>${esc(title)}</strong><span>${esc(sub)}</span></a>`;
  const eva = esc(brand.assistant.name);
  const name = esc(`${customer.firstName} ${customer.lastName}`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand.name)}360 demo · ${VENDOR}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{color-scheme:dark;--font:#e2e8f0;--muted:#8aa0c4;--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.12);--blue:#2563eb;--card:rgba(255,255,255,.045);--card-line:rgba(255,255,255,.10);--chip:rgba(255,255,255,.05);--hover-line:rgba(96,165,250,.22);--link:#60a5fa;--soft:rgba(232,237,248,.72);--strong:#fff;--hover:rgba(255,255,255,.07)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:Lato,'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif;font-size:14px;color:var(--font);background:radial-gradient(95% 80% at 82% -8%,rgba(37,99,235,.42) 0%,rgba(37,99,235,0) 58%),linear-gradient(180deg,#0c1c47 0%,#0a1538 48%,#070f26 100%);background-color:#070f26;background-attachment:fixed}
a{color:var(--link)}a:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.top{height:66px;border-bottom:1px solid var(--line);display:flex;align-items:center}.top .in{max-width:880px;width:100%;margin:0 auto;padding:0 24px}
.logo{height:40px;width:auto;display:block}
main{max-width:880px;margin:0 auto;padding:28px 24px 24px;display:flex;flex-direction:column;gap:20px}
.head{display:flex;align-items:center;gap:14px}.tile{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#3b82f6);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
h1{margin:0;font-size:24px;font-weight:900;letter-spacing:-.4px;color:var(--strong)}.head p{margin:2px 0 0;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.card{display:flex;flex-direction:column;gap:6px;padding:20px;border-radius:16px;background:var(--card);border:1px solid var(--card-line);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);text-decoration:none;color:var(--font);min-height:44px;transition:background .15s,border-color .15s}
.card strong{font-size:16px;font-weight:700;color:var(--strong)}.card span{font-size:14px;color:var(--soft);line-height:1.45}
.card:hover{background:var(--hover);border-color:var(--hover-line)}
.card.pri{background:var(--blue);border-color:var(--blue)}.card.pri span{color:#fff;opacity:.85}.card.pri:hover{background:#3b82f6;border-color:#3b82f6}
.panel{background:var(--card);border:1px solid var(--card-line);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:16px;padding:20px}
.phone{display:flex;flex-wrap:wrap;gap:20px;align-items:center}
.phone svg{width:180px;height:180px;background:#fff;border-radius:12px;padding:8px;border:1px solid var(--line2)}
.phone div{flex:1 1 260px;display:flex;flex-direction:column;gap:6px;line-height:1.5}
strong{color:var(--strong);font-weight:700}
code,kbd{background:var(--chip);border:1px solid var(--line);padding:1px 6px;border-radius:6px;font-size:13px;color:var(--font)}kbd{font-family:inherit;font-weight:700}
code{font-family:ui-monospace,Consolas,monospace;word-break:break-all}
ol{margin:10px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px;line-height:1.5}
.muted{color:var(--muted);font-size:12.5px}
button{font:inherit;font-weight:700;border:1px solid var(--line2);border-radius:999px;padding:9px 16px;background:var(--chip);color:var(--strong);cursor:pointer;min-height:40px}
button:hover{background:var(--hover)}
.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}
footer{max-width:880px;margin:0 auto;padding:0 24px 28px;font-size:12px;color:var(--muted)}
</style></head><body>
<header class="top"><div class="in"><img class="logo" src="/brand/powerconnect-logo-white.png" alt="${VENDOR}"></div></header>
<main>
<div class="head"><span class="tile" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg></span>
<div><h1>${esc(brand.name)}360 demo</h1><p>${VENDOR} concept for ${esc(brand.name)} ${esc(brand.country)}. Open the two apps in separate tabs, or the customer app on a phone.</p></div></div>
<div class="grid">
${card('/staff', 'Staff app', `${brand.name} Customer Service: ${customer.firstName}’s activity and ${brand.assistant.name} conversations live, and messages to her phone.`, true)}
${card('/app', 'Customer app', `${brand.portal}, signed in as ${customer.firstName} ${customer.lastName} (sample customer). Open it on a phone too.`, false)}
</div>
<section class="panel phone">${qr}<div><strong>Open the customer app on a phone</strong><span>Scan with the phone camera, or open <code>${esc(phoneUrl)}</code>. ${reach} The phone and the staff app stay in sync through this server.</span>
${otherUrls.length ? `<span class="muted">Other addresses for this laptop: ${otherUrls.map(esc).join(', ')}</span>` : ''}
<span class="muted">Phone notifications need HTTPS (a hosted URL); on this laptop they work at localhost.</span></div></section>
<section class="panel"><strong style="font-size:15px">Demo script</strong>
<ol>
<li>Open the <strong>Staff app</strong> in one tab and the <strong>Customer app</strong> (${name}) in another tab or on a phone.</li>
<li><strong>Live activity:</strong> Customer app → <em>Bills &amp; payments</em> → <em>Adjust installment</em> → €198 → Confirm. It appears in the staff app’s <em>Live activity</em> at once.</li>
<li><strong>${eva}:</strong> press <kbd>Shift</kbd>+<kbd>P</kbd> for the presenter bar → <kbd>4</kbd>. ${eva} explains why the bill is higher; follow up with “and last month?”. The conversation shows live in the staff app.</li>
<li><strong>Message the customer:</strong> Staff app → <em>Cheapest hours tonight</em> → Send. A banner pops up in the customer app, and a phone notification if it is on (<em>My account</em> → <em>Preferences</em>).</li>
<li><strong>Reset:</strong> <kbd>R</kbd> in the presenter bar, <em>Reset demo</em> in the staff app, or the button below.</li>
</ol>
<div class="row"><button id="reset" type="button">Reset demo</button><span id="msg" class="muted" role="status"></span></div></section>
</main>
<footer>Concept demo · Sample data, not connected to ${esc(brand.name)} systems · <a href="/app/mobile-preview">Mobile preview</a></footer>
<script>
document.getElementById('reset').onclick=async()=>{const m=document.getElementById('msg');m.textContent='Resetting…';const r=await fetch('/api/demo/reset',{method:'POST'});m.textContent=r.ok?'Demo reset.':'Reset failed.';};
</script>
</body></html>`;
}
