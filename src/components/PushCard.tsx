import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useLive } from '../api/live';
import { disablePush, enablePush, pushState, type PushState } from '../api/push';
import { brand } from '../brand';
import { useToast } from './toast';

/**
 * "Notifications on this phone" switch: asks the browser for permission and registers this device with
 * the server, so a message from ENGIE Klantenservice arrives as a real notification, app open or not.
 */
export function PushCard() {
  const { t } = useI18n();
  const toast = useToast();
  const { online, track } = useLive();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    pushState().then(
      (s) => alive && setState(s),
      () => alive && setState('unsupported'),
    );
    return () => {
      alive = false;
    };
  }, []);

  const on = state === 'on';
  const canSwitch = online && (state === 'on' || state === 'off') && !busy;

  const hint = !online
    ? t('Needs the demo server: start the app with start-demo.cmd.', 'Heeft de demoserver nodig: start de app met start-demo.cmd.')
    : state === 'needs-install'
      ? t('On iPhone: tap Share, then “Add to Home Screen”, and open the app from there.', 'Op iPhone: tik op Deel en dan “Zet op beginscherm”, en open de app vanaf daar.')
      : state === 'blocked'
        ? t('Notifications are blocked for this site. Allow them in your browser settings.', 'Meldingen zijn geblokkeerd voor deze site. Sta ze toe in je browserinstellingen.')
        : state === 'unsupported'
          ? t('This browser cannot receive notifications here (it needs https or localhost).', 'Deze browser kan hier geen meldingen ontvangen (https of localhost is nodig).')
          : on
            ? t(`On. Messages from ${brand.name} Customer Service reach this device.`, `Aan. Berichten van ${brand.name} Klantenservice komen op dit apparaat binnen.`)
            : t(`Get messages from ${brand.name} as a notification, even when the app is closed.`, `Ontvang berichten van ${brand.name} als melding, ook als de app dicht is.`);

  const flip = async () => {
    setBusy(true);
    try {
      const next = on ? await disablePush() : await enablePush();
      setState(next);
      if (next === 'on') {
        track('push_subscribed');
        toast(t('Notifications are on for this device', 'Meldingen staan aan op dit apparaat'));
      } else if (!on && next === 'blocked') {
        toast(t('Notifications are blocked in the browser', 'Meldingen zijn geblokkeerd in de browser'));
      } else if (on) {
        toast(t('Notifications turned off', 'Meldingen uitgezet'));
      }
    } catch {
      toast(t('Could not change notifications. Please try again.', 'Meldingen konden niet worden gewijzigd. Probeer het opnieuw.'));
    } finally {
      setBusy(false);
    }
  };

  const label = t('Notifications on this device', 'Meldingen op dit apparaat');
  return (
    <div className="list-row" id="push">
      <BellRing size={20} style={{ color: 'var(--blue)', flex: 'none' }} aria-hidden />
      <div className="grow">
        <div className="small strong">{label}</div>
        <div className="xs muted">{hint}</div>
      </div>
      <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={!canSwitch} onClick={() => void flip()} />
    </div>
  );
}
