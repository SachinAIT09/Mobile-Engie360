import { useState } from 'react';
import { Gauge, Home, Landmark, LogOut, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { signOut } from '../lib/session';
import { useNavigate } from 'react-router-dom';
import { contract, customer } from '../data/customer';
import { Card, Expander, Modal, PageHead } from '../components/ui';
import { useToast } from '../components/toast';
import { useLive } from '../api/live';
import { PushCard } from '../components/PushCard';

function Toggle({ label, desc, defaultOn = false }: { label: string; desc?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  const toast = useToast();
  const { t } = useI18n();
  return (
    <div className="list-row">
      <div className="grow">
        <div className="small strong">{label}</div>
        {desc && <div className="xs muted">{desc}</div>}
      </div>
      <button
        className={`switch${on ? ' on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => {
          setOn(!on);
          toast(t('Preference saved', 'Voorkeur opgeslagen'));
        }}
      />
    </div>
  );
}

export default function Account() {
  const { t, tx, num, eur, date, lang, setLang } = useI18n();
  const { pref, setPref } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState({ email: customer.email, phone: customer.phone });
  const [draft, setDraft] = useState(contact);
  const { saveContact, pay } = useLive();
  const { autopay } = pay;

  return (
    <>
      <PageHead keepSub eyebrow={t('My account', 'Mijn account')} title={`${customer.firstName} ${customer.lastName}`} sub={`${t('Customer number', 'Klantnummer')} ${customer.customerNo} · ${t('customer since', 'klant sinds')} ${date(customer.memberSince, { month: 'long', year: 'numeric' })}`} />

      <Card
        title={t('Personal details', 'Persoonlijke gegevens')}
        action={
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDraft(contact);
              setEditing(true);
            }}
          >
            <Pencil size={14} /> {t('Edit', 'Wijzig')}
          </button>
        }
      >
        <div className="row" style={{ gap: 14, marginBottom: 14 }}>
          <span className="avatar lg">{customer.initials}</span>
          <div>
            <div className="strong">
              {customer.firstName} {customer.lastName}
            </div>
            <div className="xs muted">{tx(customer.household.homeType)}</div>
          </div>
        </div>
        <div className="list small">
          <div className="list-row">
            <Mail size={16} color="#64758b" /> <span className="grow">{contact.email}</span>
          </div>
          <div className="list-row">
            <Phone size={16} color="#64758b" /> <span className="grow">{contact.phone}</span>
          </div>
          <div className="list-row">
            <MapPin size={16} color="#64758b" />
            <span className="grow">
              {customer.address.street}, {customer.address.postcode} {customer.address.city}
            </span>
          </div>
          <div className="list-row">
            <Home size={16} color="#64758b" />
            <span className="grow">
              {customer.household.residents} {t('residents', 'bewoners')} · {customer.household.sizeM2} m²
            </span>
          </div>
        </div>
      </Card>


      <Card id="meter" className="mt" title={t('Meter readings', 'Meterstanden')} sub={`${tx(contract.meter.type)} · ${t('read automatically', 'automatisch uitgelezen')}`}>
        <div className="trio">
          {[
            { l: t('Electricity normal', 'Stroom normaal'), v: num(contract.meter.electricityT1), u: 'kWh' },
            { l: t('Electricity low', 'Stroom dal'), v: num(contract.meter.electricityT2), u: 'kWh' },
            { l: 'Gas', v: num(contract.meter.gas, 1), u: 'm³' },
          ].map((m) => (
            <div key={m.l} className="trio-item">
              <div className="xs muted strong">{m.l}</div>
              <div className="strong num">{m.v}</div>
              <div className="xs muted">{m.u}</div>
            </div>
          ))}
        </div>
        <p className="xs muted mt-s row" style={{ gap: 6 }}>
          <Gauge size={14} /> {t('Last reading', 'Laatste stand')} {date(contract.meter.lastReading, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.{' '}
          {t('You don’t need to submit readings.', 'Je hoeft geen meterstanden door te geven.')}
        </p>
      </Card>


      <Card id="preferences" className="mt" title={t('Preferences', 'Voorkeuren')}>
        <div className="list-row">
          <div className="grow">
            <div className="small strong">{t('Language', 'Taal')}</div>
            <div className="xs muted">{t('Portal and assistant', 'Portaal en assistent')}</div>
          </div>
          <div className="seg">
            <button className={lang === 'nl' ? 'on' : ''} onClick={() => setLang('nl')}>
              Nederlands
            </button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
              English
            </button>
          </div>
        </div>
        <div className="list-row">
          <div className="grow">
            <div className="small strong">{t('Theme', 'Thema')}</div>
            <div className="xs muted">{t('Light, dark or match your phone', 'Licht, donker of zoals je telefoon')}</div>
          </div>
          <div className="seg">
            <button className={pref === 'light' ? 'on' : ''} aria-pressed={pref === 'light'} onClick={() => setPref('light')}>
              {t('Light', 'Licht')}
            </button>
            <button className={pref === 'dark' ? 'on' : ''} aria-pressed={pref === 'dark'} onClick={() => setPref('dark')}>
              {t('Dark', 'Donker')}
            </button>
            <button className={pref === 'system' ? 'on' : ''} aria-pressed={pref === 'system'} onClick={() => setPref('system')}>
              {t('System', 'Systeem')}
            </button>
          </div>
        </div>
        <PushCard />
      </Card>

      <div className="mt">
      <Expander title={t('Alerts and reports', 'Meldingen en rapporten')} meta={<span className="xs muted">{t('4 settings', '4 instellingen')}</span>}>
        <Toggle label={t('Usage alerts', 'Verbruiksmeldingen')} desc={t('Unusual consumption and appliance faults', 'Afwijkend verbruik en storingen aan apparaten')} defaultOn />
        <Toggle label={t('Cheapest-hours notification', 'Melding goedkoopste uren')} desc={t('Daily push at 15:00 with tomorrow’s prices', 'Dagelijkse push om 15:00 met prijzen van morgen')} defaultOn />
        <Toggle label={t('Appliance recognition', 'Apparaatherkenning')} desc={t('Uses your smart-meter data for personal advice', 'Gebruikt je slimme-meterdata voor persoonlijk advies')} defaultOn />
        <Toggle label={t('Monthly energy report by email', 'Maandelijks energierapport per e-mail')} />
      </Expander>
      <Expander title={t('Contract', 'Contract')} meta={<span className="badge ok">{t('Active', 'Actief')}</span>}>
        <div className="strong">{tx(contract.product)}</div>
        <dl className="kv mt small">
          <dt>{t('Start date', 'Startdatum')}</dt>
          <dd>{date(contract.startDate)}</dd>
          <dt>{t('Electricity', 'Stroom')}</dt>
          <dd>{tx(contract.electricity.type)}</dd>
          <dt>Gas</dt>
          <dd>{tx(contract.gas.type)}</dd>
          <dt>{t('Origin', 'Herkomst')}</dt>
          <dd>{tx(contract.electricity.origin)}</dd>
          <dt>EAN {t('electricity', 'stroom')}</dt>
          <dd className="num xs">{contract.electricity.ean}</dd>
          <dt>EAN gas</dt>
          <dd className="num xs">{contract.gas.ean}</dd>
        </dl>
      </Expander>
      <Expander title={t('Payment details', 'Betaalgegevens')} meta={<span className="xs muted">{autopay ? tx(customer.paymentMethod) : t('You pay yourself', 'Je betaalt zelf')}</span>}>
        <div className="row" style={{ gap: 12 }}>
          <span className="kpi-ic eur">
            <Landmark size={19} />
          </span>
          <div>
            <div className="strong num">{customer.iban}</div>
            <div className="xs muted">
              {tx(customer.paymentMethod)} · {t('on the', 'op de')} {customer.collectionDay}
              {t('th', 'e')}
            </div>
          </div>
        </div>
        <dl className="kv mt small">
          <dt>{t('Monthly installment', 'Termijnbedrag')}</dt>
          <dd className="num">{eur(contract.installment)}</dd>
          <dt>{t('Invoices by', 'Nota’s via')}</dt>
          <dd>{t('Email (paperless)', 'E-mail (papierloos)')}</dd>
        </dl>
        <button className="btn btn-outline btn-sm mt" onClick={() => toast(t('To change your bank account we first verify the new IBAN with your bank.', 'Om je rekeningnummer te wijzigen controleren we de nieuwe IBAN eerst bij je bank.'))}>
          {t('Change bank account', 'Rekeningnummer wijzigen')}
        </button>
      </Expander>
      </div>
      <div className="row mt" style={{ justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
        <button
          className="btn btn-outline"
          onClick={() => {
            signOut();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut size={17} /> {t('Sign out', 'Uitloggen')}
        </button>
      </div>

      {editing && (
        <Modal
          title={t('Edit contact details', 'Contactgegevens wijzigen')}
          onClose={() => setEditing(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setEditing(false)}>
                {t('Cancel', 'Annuleren')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setContact(draft);
                  saveContact(draft);
                  setEditing(false);
                  toast(t('Contact details updated', 'Contactgegevens bijgewerkt'));
                }}
              >
                {t('Save', 'Opslaan')}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <label className="field">
              {t('Email', 'E-mail')}
              <input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="field">
              {t('Phone', 'Telefoon')}
              <input className="input" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
