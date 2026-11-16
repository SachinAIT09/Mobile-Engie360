import QRCode from 'qrcode';
import { brand } from '../src/brand';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Presenter start page at /start: links to every surface, the phone QR and the demo script. */
export async function startPage(phoneUrl: string, otherUrls: string[]): Promise<string> {
  const qr = await QRCode.toString(phoneUrl, { type: 'svg', margin: 1, color: { dark: '#0b2240', light: '#ffffff' } });
  const apps = [
    ['/', `${brand.portal} customer portal`, 'Sanne’s energy, bills, insights and Eva. Open it on the phone too.'],
    ['/staff', `${brand.name} staff app`, 'Customer service view: Sanne’s activity and Eva chats live; send her a message or push.'],
    ['/website-demo', `${brand.name}.nl widget`, `${brand.assistant.name} on the public website: visitor vs signed-in.`],
    ['/mobile-preview', 'Mobile preview', 'The portal in a phone frame, for a laptop-only demo.'],
  ];
  const steps = [
    'Open the <b>staff app</b> on the laptop and the <b>customer portal</b> on a phone (scan the QR).',
    'On the phone, tap <b>Enable notifications</b> so staff messages arrive as push.',
    'Customer: change the installment to €198. Staff: the change appears live in the activity feed.',
    `Customer: ask ${esc(brand.assistant.name)} “Why is my energy bill higher this month?”. Staff: the conversation shows live.`,
    'Staff: send “Cheapest hours tonight”. The phone gets a push and an in-app banner.',
    'Finish with <b>Reset demo</b> to start fresh.',
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand.name)}360 demo</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
<style>
:root{--blue:#00aaff;--ink:#0b2240;--muted:#64758b;--line:#e3e9f0;--bg:#f4f7fa}
*{box-sizing:border-box}body{margin:0;font-family:Lato,system-ui,sans-serif;background:var(--bg);color:var(--ink)}
.wrap{max-width:1080px;margin:0 auto;padding:40px 24px 56px}
header{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.mark{font-weight:900;font-size:28px;letter-spacing:.04em;color:var(--blue);border-top:3px solid var(--blue);border-radius:50% 50% 0 0/14px 14px 0 0;padding-top:2px}
header span{color:var(--muted);font-weight:700}
h1{font-size:30px;margin:0 0 6px}p.lead{color:var(--muted);margin:0 0 28px}
.grid{display:grid;grid-template-columns:1.4fr 1fr;gap:20px}
.apps{display:grid;grid-template-columns:1fr 1fr;gap:14px}
a.app{display:block;background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}
a.app:hover{border-color:var(--blue);transform:translateY(-2px)}a.app b{display:block;font-size:17px;margin-bottom:6px}a.app span{color:var(--muted);font-size:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px}
.qr{width:200px;height:200px;margin:6px auto 10px}.qr svg{width:100%;height:100%}
code{display:block;text-align:center;color:#006fa8;font-size:13px;word-break:break-all}
ol{margin:8px 0 0;padding-left:20px;line-height:1.7}h2{font-size:17px;margin:0 0 6px}
button{margin-top:14px;font:inherit;font-weight:700;border:0;border-radius:999px;padding:11px 18px;background:var(--ink);color:#fff;cursor:pointer}
.muted{color:var(--muted);font-size:13px}.mt{margin-top:20px}
@media(max-width:820px){.grid,.apps{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<header><span class="mark">${esc(brand.name)}</span><span>${esc(brand.name)}360 demo · PowerConnect.AI concept</span></header>
<h1>Start here</h1><p class="lead">Everything runs from this one server. Sample data only; not connected to ${esc(brand.name)} systems.</p>
<div class="grid"><div>
<div class="apps">${apps.map(([href, title, desc]) => `<a class="app" href="${href}"><b>${esc(title!)}</b><span>${esc(desc!)}</span></a>`).join('')}</div>
<div class="card mt"><h2>Demo script</h2><ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
<p class="muted">In the portal, press <b>Shift+P</b> for the presenter bar.</p>
<button id="reset">Reset demo</button> <span id="msg" class="muted"></span></div>
</div><div class="card" style="text-align:center"><h2>Open on your phone</h2><p class="muted">Scan with the camera. On a laptop, the phone must be on the same Wi-Fi.</p>
<div class="qr">${qr}</div><code>${esc(phoneUrl)}</code>
${otherUrls.length ? `<p class="muted">Other addresses: ${otherUrls.map(esc).join(', ')}</p>` : ''}
<p class="muted mt">Push notifications need HTTPS on phones (a hosted URL), or <code style="display:inline">localhost</code> on this laptop.</p></div></div>
</div><script>
document.getElementById('reset').onclick=async()=>{const m=document.getElementById('msg');m.textContent='Resetting…';const r=await fetch('/api/demo/reset',{method:'POST'});m.textContent=r.ok?'Demo reset.':'Reset failed';};
</script></body></html>`;
}
