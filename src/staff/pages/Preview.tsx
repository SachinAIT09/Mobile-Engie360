import { useState } from 'react';
import { RotateCw, Smartphone } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { PhoneQr } from '../../components/PhoneQr';
import { portalUrl } from '../../lib/routes';
import { brand } from '../../brand';
import { StaffHead } from '../parts';
import './preview.css';

const SCREENS = [
  { path: '/', en: 'Home', nl: 'Home' },
  { path: '/energy', en: 'Energy', nl: 'Energie' },
  { path: '/billing', en: 'Billing', nl: 'Betalen' },
  { path: '/account', en: 'Profile', nl: 'Profiel' },
  { path: '/insights', en: 'Insights', nl: 'Inzichten' },
  { path: '/smart-energy', en: 'Smart Energy', nl: 'Slimme Energie' },
  { path: '/assistant', en: 'Eva', nl: 'Eva' },
];

/** The customer app in a phone frame, for a laptop-only demo. Everything inside is live. */
export default function StaffPreview() {
  const { t } = useI18n();
  const [path, setPath] = useState('/');
  const [nonce, setNonce] = useState(0);

  return (
    <>
      <StaffHead
        icon={Smartphone}
        title={t('Phone preview', 'Telefoonweergave')}
        sub={t(`${brand.portal} at phone size (390 × 844), signed in and live. Use it when no real phone is at hand.`, `${brand.portal} op telefoonformaat (390 × 844), ingelogd en live. Handig als er geen echte telefoon bij de hand is.`)}
      />
      <div className="mp">
        <aside className="mp-side">
          <div className="mp-screens" role="group" aria-label={t('Screens', 'Schermen')}>
            {SCREENS.map((s) => (
              <button key={s.path} className={path === s.path ? 'on' : ''} aria-pressed={path === s.path} onClick={() => setPath(s.path)}>
                {t(s.en, s.nl)}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setNonce((n) => n + 1)}>
            <RotateCw size={14} /> {t('Reload phone', 'Telefoon herladen')}
          </button>
          <PhoneQr path={portalUrl(path)} />
          <p className="xs muted">{t(`Tip: tap the ${brand.assistant.name} button in the phone to show the chat.`, `Tip: tik in de telefoon op de ${brand.assistant.name}-knop om de chat te tonen.`)}</p>
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
              <iframe key={`${path}-${nonce}`} src={portalUrl(path)} title={t('Phone preview', 'Telefoonweergave')} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
