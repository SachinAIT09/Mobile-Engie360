import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone } from 'lucide-react';
import { useI18n } from '../lib/i18n';

/** Prefer the dev/preview server's LAN address; on a hosted build the page origin already works. */
async function phoneUrl(path: string): Promise<string> {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (local) {
    try {
      const r = await fetch('/__demo/lan');
      if (r.ok) {
        const { urls } = (await r.json()) as { urls: string[] };
        const lan = urls.find((u) => /^http:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(u)) ?? urls[0];
        if (lan) return new URL(path, lan).toString();
      }
    } catch {
      /* static hosting: no endpoint */
    }
  }
  return new URL(path, window.location.origin).toString();
}

/** QR code that opens the demo on a phone. */
export function PhoneQr({ path = '/' }: { path?: string }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);

  useEffect(() => {
    let alive = true;
    phoneUrl(path)
      .then(async (url) => ({ url, svg: await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#0b2240', light: '#ffffff' } }) }))
      .then((v) => {
        if (alive) setQr(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);

  const lanMissing = qr && /localhost|127\.0\.0\.1/.test(qr.url);
  return (
    <div className="phone-qr">
      <div className="phone-qr-code" aria-hidden dangerouslySetInnerHTML={{ __html: qr?.svg ?? '' }} />
      <div>
        <div className="row strong small" style={{ gap: 6 }}>
          <Smartphone size={15} /> {t('Open on your phone', 'Open op je telefoon')}
        </div>
        <p className="xs muted" style={{ marginTop: 4 }}>
          {lanMissing
            ? t('Start the dev server with network access to scan from a phone.', 'Start de server met netwerktoegang om vanaf een telefoon te scannen.')
            : t('Scan with the camera. The phone must be on the same Wi-Fi as this laptop.', 'Scan met de camera. De telefoon moet op hetzelfde wifi-netwerk zitten als deze laptop.')}
        </p>
        {qr && <code className="phone-qr-url">{qr.url}</code>}
      </div>
    </div>
  );
}
