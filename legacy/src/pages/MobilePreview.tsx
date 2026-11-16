import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Brand } from '../components/Layout';
import { PhoneQr } from '../components/PhoneQr';
import './mobile-preview.css';
import { brand } from '../brand';

const SCREENS = [
  { path: '/', en: 'Home', nl: 'Home' },
  { path: '/energy', en: 'Usage', nl: 'Verbruik' },
  { path: '/billing', en: 'Bills', nl: 'Nota’s' },
  { path: '/insights', en: 'Insights', nl: 'Inzichten' },
  { path: '/smart-energy', en: 'Smart Energy', nl: 'Slimme Energie' },
  { path: '/assistant', en: 'Eva', nl: 'Eva' },
  { path: '/account', en: 'Account', nl: 'Account' },
  { path: '/website-demo', en: 'Website widget', nl: 'Website-widget' },
];

export default function MobilePreview() {
  const { t } = useI18n();
  const [path, setPath] = useState('/');
  const [nonce, setNonce] = useState(0);

  return (
    <div className="mp">
      <aside className="mp-side">
        <Link to="/" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={15} /> {t('Back to desktop', 'Terug naar desktop')}
        </Link>
        <Brand sub={`${brand.portal} app`} />
        <h1>{t('Mobile experience', 'Mobiele ervaring')}</h1>
        <p className="muted">
          {t(
            'The same portal, rendered at iPhone size (390 × 844). Bottom tabs, a slide-out menu, touch-sized controls and a full-screen assistant. Everything inside the phone is live and clickable.',
            'Hetzelfde portaal op iPhone-formaat (390 × 844). Tabbladen onderin, uitschuifmenu, aanraakvriendelijke knoppen en een assistent op volledig scherm. Alles in de telefoon is live en klikbaar.',
          )}
        </p>
        <div className="mp-screens">
          {SCREENS.map((s) => (
            <button key={s.path} className={path === s.path ? 'on' : ''} onClick={() => setPath(s.path)}>
              {t(s.en, s.nl)}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setNonce((n) => n + 1)}>
          <RotateCw size={14} /> {t('Reload phone', 'Telefoon herladen')}
        </button>
        <PhoneQr path={path} />
        <p className="xs muted">{t(`Tip: open ${brand.assistant.name} in the phone to show the full-screen chat.`, `Tip: open ${brand.assistant.name} in de telefoon om de chat op volledig scherm te laten zien.`)}</p>
      </aside>
      <div className="mp-stage">
        <div className="phone">
          <div className="phone-screen">
            <div className="phone-status" aria-hidden>
              <span>14:20</span>
              <span className="phone-notch" />
              <span className="phone-icons">
                <i />
                <i />
                <b />
              </span>
            </div>
            <iframe key={`${path}-${nonce}`} src={path} title={t('Mobile preview', 'Mobiele preview')} />
          </div>
        </div>
      </div>
    </div>
  );
}
