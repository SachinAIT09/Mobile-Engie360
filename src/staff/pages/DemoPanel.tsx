import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Keyboard, RotateCcw, Settings, Smartphone } from 'lucide-react';
import type { MessageTemplate } from '../../../shared/contract';
import { PhoneQr } from '../../components/PhoneQr';
import { InsightIc } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useI18n } from '../../lib/i18n';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { STAFF_NAME } from '../kinds';
import { StaffHead } from '../parts';

/**
 * Demo control panel (as in Hydro Mobile360): fire any message at the customer's phone with one click,
 * pair a phone, reset. Not part of the product.
 */
export default function DemoPanel() {
  const { t, tx, lang } = useI18n();
  const toast = useToast();
  const { overview: o, templates, send, connection, confirmReset } = useStaff();
  const [sent, setSent] = useState<string | null>(null);
  const name = o?.customer.firstName ?? '';
  const online = (o?.online ?? 0) > 0;
  const devices = o?.pushDevices ?? 0;

  const fire = (tpl: MessageTemplate) => {
    send({ title: tpl.title, body: tpl.body, icon: tpl.icon, to: tpl.to, push: true, sender: `${STAFF_NAME} · ${brand.name} ${lang === 'nl' ? 'Klantenservice' : 'Customer Service'}` }).then(
      (r) => {
        setSent(tpl.id);
        setTimeout(() => setSent((s) => (s === tpl.id ? null : s)), 2500);
        toast(r.pushed > 0 ? t(`Sent to ${name}’s app and ${r.pushed} phone${r.pushed === 1 ? '' : 's'}`, `Verstuurd naar de app van ${name} en ${r.pushed} telefoon${r.pushed === 1 ? '' : 's'}`) : t(`Sent to ${name}’s app`, `Verstuurd naar de app van ${name}`));
      },
      () => toast(t('Could not send', 'Versturen mislukt')),
    );
  };

  return (
    <>
      <StaffHead
        icon={Settings}
        title={t('Demo control panel', 'Demo-bedieningspaneel')}
        sub={t('Fire a message at the customer app with one click. Press Shift+P on any staff page for the presenter bar. Not part of the product.', 'Stuur met één klik een bericht naar de klant-app. Druk op Shift+P op elke medewerkerspagina voor de presentatiebalk. Geen onderdeel van het product.')}
      />

      <section className="card" aria-labelledby="send-to-phone">
        <div className="card-head">
          <div className="row" style={{ gap: 12 }}>
            <span className="staff-head-ic sm" aria-hidden>
              <Smartphone size={18} />
            </span>
            <div>
              <h2 id="send-to-phone">{t('Send to phone', 'Naar telefoon sturen')}</h2>
              <p>{t(`Tap a message: it shows in ${name}’s app right away, and as a phone notification if they are on.`, `Tik op een bericht: het staat meteen in de app van ${name}, en als melding op de telefoon als die aan staan.`)}</p>
            </div>
          </div>
          <span className={`badge ${online ? 'ok' : 'neutral'}`}>
            <i className={`staff-dot${online ? ' on' : ''}`} aria-hidden /> {online ? t(`${name} is in the app`, `${name} is in de app`) : t(`${name} is not in the app`, `${name} is niet in de app`)}
          </span>
        </div>
        {!online && (
          <p className="staff-note" role="status">
            {t(`${name}’s app is not open. Sign in to ${brand.portal} on a phone (scan the code below) to see messages arrive.`, `De app van ${name} is niet open. Log in bij ${brand.portal} op een telefoon (scan de code hieronder) om berichten te zien binnenkomen.`)}
          </p>
        )}
        <div className="send-grid">
          {templates.map((tpl) => (
            <button key={tpl.id} className={`send-card${sent === tpl.id ? ' sent' : ''}`} onClick={() => fire(tpl)} disabled={connection !== 'live'}>
              {sent === tpl.id ? <span className="kpi-ic eur"><Check size={18} /></span> : <InsightIc icon={tpl.icon} size={38} />}
              <span>
                <strong>{tx(tpl.title)}</strong>
                <span className="small muted">{tx(tpl.body)}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="xs muted mt-s">
          {devices > 0 ? t(`Phone notifications: on for ${devices} device${devices === 1 ? '' : 's'}.`, `Telefoonmeldingen: aan op ${devices} ${devices === 1 ? 'apparaat' : 'apparaten'}.`) : t('Phone notifications: not turned on yet (customer app → Profile → Preferences).', 'Telefoonmeldingen: nog niet aangezet (klant-app → Profiel → Voorkeuren).')}{' '}
          <Link to="/staff/messages">{t('Write your own message', 'Schrijf een eigen bericht')}</Link>
        </p>
      </section>

      <div className="staff-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{t('Phone pairing', 'Telefoon koppelen')}</h2>
              <p>{t(`Open ${brand.portal} on any phone and sign in as ${name}.`, `Open ${brand.portal} op een telefoon en log in als ${name}.`)}</p>
            </div>
          </div>
          <PhoneQr path="/app" />
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{t('Presenter', 'Presentator')}</h2>
              <p>{t('Run the demo from the keyboard.', 'Bedien de demo met het toetsenbord.')}</p>
            </div>
            <Keyboard size={20} className="muted" aria-hidden />
          </div>
          <ul className="small keys">
            <li>
              <kbd>Shift</kbd>+<kbd>P</kbd> {t('presenter bar', 'presentatiebalk')}
            </li>
            <li>
              <kbd>N</kbd> / <kbd>B</kbd> {t('next / back', 'volgende / terug')} · <kbd>1</kbd>–<kbd>5</kbd> {t('jump to a step', 'naar een stap')}
            </li>
            <li>
              <kbd>R</kbd> {t('reset the demo', 'demo resetten')}
            </li>
          </ul>
          <button className="btn btn-outline mt" onClick={confirmReset} disabled={connection !== 'live'}>
            <RotateCcw size={16} /> {t('Reset demo', 'Demo resetten')}
          </button>
        </section>
      </div>
    </>
  );
}
