import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity as ActivityIcon, ArrowRight, BellRing, Check, CheckCheck, Clock, Eye, Mail, Send, X } from 'lucide-react';
import type { Activity, AttentionItem, BillingResponse, EnergyResponse, InstallmentState, OutboxItem } from '../../shared/contract';
import { ChartLegend, UsageChart, type Metric } from '../components/UsageChart';
import { Card, InsightIc, Seg } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { brand } from '../brand';
import { DEMO_TZ } from '../lib/time';
import { KIND_ICON, clock } from './kinds';
import { groupVisits, visitMinutes } from './visits';

/** "Needs attention": what to look at for this customer, each with a suggested next step (the Hydro live-events panel). */
export function AttentionPanel({ items, customerId }: { items: AttentionItem[]; customerId?: string }) {
  const { t, tx } = useI18n();
  const open = items.filter((i) => i.status === 'open').length;
  return (
    <Card
      title={t('Needs attention', 'Vraagt aandacht')}
      sub={t('Found in the customer’s data, with a suggested next step', 'Gevonden in de gegevens van de klant, met een voorgestelde vervolgstap')}
      action={<span className={`badge ${open > 0 ? 'warn' : 'ok'}`}>{open > 0 ? t(`${open} open`, `${open} open`) : t('All followed up', 'Alles opgevolgd')}</span>}
      className="attention"
    >
      {items.length === 0 && (
        <p className="small muted staff-empty">
          <CheckCheck size={18} aria-hidden /> {t('Nothing needs attention for this customer.', 'Voor deze klant vraagt niets aandacht.')}
        </p>
      )}
      <ul className="attention-list">
        {items.map((i) => (
          <li key={i.id} className={`attention-row ${i.status} tone-${i.tone}`}>
            <InsightIc icon={i.icon} kind={i.tone === 'alert' ? 'alert' : i.tone === 'warn' ? 'billing' : undefined} size={38} />
            <div className="grow">
              <div className="strong">{tx(i.title)}</div>
              <div className="small muted">{tx(i.detail)}</div>
              {i.status !== 'open' && i.note && (
                <span className={`badge ${i.status === 'done' ? 'ok' : 'info'} attention-note`}>
                  {i.status === 'done' ? <CheckCheck size={13} aria-hidden /> : <Check size={13} aria-hidden />} {tx(i.note)}
                </span>
              )}
            </div>
            {i.status === 'open' &&
              (i.templateId ? (
                <Link to={`/staff/messages?template=${i.templateId}${customerId ? `&customer=${customerId}` : ''}`} className="btn btn-primary btn-sm">
                  <Send size={14} /> {t('Send message', 'Stuur bericht')}
                </Link>
              ) : (
                <Link to={i.to ?? '/staff'} className="btn btn-outline btn-sm">
                  {t('Open', 'Openen')} <ArrowRight size={14} />
                </Link>
              ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Twelve months of usage against the year before, electricity or gas. */
export function UsageCard({ energy }: { energy: EnergyResponse }) {
  const { t } = useI18n();
  const [metric, setMetric] = useState<Metric>('electricity');
  return (
    <Card
      title={t('Usage, last 12 months', 'Verbruik, laatste 12 maanden')}
      sub={t('Compared with the year before', 'Vergeleken met het jaar ervoor')}
      action={
        <Seg
          label={t('Energy type', 'Energiesoort')}
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'electricity', label: t('Electricity', 'Stroom') },
            { value: 'gas', label: t('Gas', 'Gas') },
          ]}
        />
      }
    >
      <UsageChart data={energy.monthly} metric={metric} compare showEv height={230} />
      <ChartLegend metric={metric} compare ev />
    </Card>
  );
}

/** What the customer pays in installments against what the year will cost: why the annual statement is what it is. */
export function CostCard({ billing, installment }: { billing: BillingResponse; installment: InstallmentState }) {
  const { t, tx, eur } = useI18n();
  const a = billing.annualOverview;
  const effective = installment.pending?.amount ?? installment.current;
  const covered = a.paidSoFar + effective * 4;
  const gap = a.estimatedTotal - covered;
  const max = Math.max(a.estimatedTotal, covered);
  const rows = [
    { label: t('Paid so far (8 installments)', 'Tot nu toe betaald (8 termijnen)'), value: a.paidSoFar, cls: 'paid' },
    { label: t(`Installments by the end of the year, at ${eur(effective, 0)} a month`, `Termijnen aan het eind van het jaar, bij ${eur(effective, 0)} per maand`), value: covered, cls: 'covered' },
    { label: t('Estimated cost for the year', 'Geschatte kosten voor het jaar'), value: a.estimatedTotal, cls: 'cost' },
  ];
  return (
    <Card title={t('Cost against installments', 'Kosten tegenover termijnen')} sub={tx(a.year)} action={<span className={`badge ${gap > 0 ? 'warn' : 'ok'}`}>{gap > 0 ? t(`${eur(gap, 0)} short`, `${eur(gap, 0)} tekort`) : t('Covered', 'Gedekt')}</span>}>
      <div className="cost-bars">
        {rows.map((r) => (
          <div key={r.cls} className="cost-row">
            <div className="row between small">
              <span>{r.label}</span>
              <span className="num strong">{eur(r.value, 0)}</span>
            </div>
            <div className="cost-track" aria-hidden>
              <span className={r.cls} style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="small muted mt">
        {gap > 0
          ? t(
              `At this installment the annual statement in March comes to about ${eur(gap, 0)} to pay. The advised installment is ${eur(installment.advised, 0)}.`,
              `Met dit termijnbedrag komt de jaarnota in maart op zo’n ${eur(gap, 0)} bijbetalen. Het geadviseerde termijnbedrag is ${eur(installment.advised, 0)}.`,
            )
          : t(`At this installment the customer gets about ${eur(-gap, 0)} back at the annual statement.`, `Met dit termijnbedrag krijgt de klant bij de jaarnota zo’n ${eur(-gap, 0)} terug.`)}
      </p>
    </Card>
  );
}

/** How a message looks as a notification on the customer's phone. */
export function PhonePreview({ title, body }: { title: string; body: string }) {
  const { t } = useI18n();
  return (
    <div className="phone-preview" aria-label={t('Preview on the phone', 'Voorbeeld op de telefoon')}>
      <span className="phone-preview-time num" aria-hidden>
        14:20
      </span>
      <div className="phone-preview-note">
        <span className="phone-preview-app">
          <i aria-hidden>{brand.name.slice(0, 1)}</i> {brand.portal} <span className="muted">· {t('now', 'nu')}</span>
        </span>
        <b>{title || t('Your title', 'Je titel')}</b>
        <span>{body || t('Your message appears here as you type.', 'Je bericht verschijnt hier terwijl je typt.')}</span>
      </div>
    </div>
  );
}

/** Sent and scheduled messages with their delivery status: scheduled → sent → on the phone → read. */
export function Outbox({ items, onCancel, limit = 8 }: { items: OutboxItem[]; onCancel?: (id: string) => void; limit?: number }) {
  const { t, tx, lang } = useI18n();
  const list = items.slice(0, limit);
  const hm = (iso: string) => clock(iso, lang).slice(0, 5);
  return (
    <Card title={t('Sent and scheduled', 'Verstuurd en ingepland')} sub={t('Delivery status of each message', 'Afleverstatus per bericht')} className="outbox-card">
      {list.length === 0 ? (
        <p className="small muted staff-empty">
          <Mail size={18} aria-hidden /> {t('No messages yet. Send one from the composer.', 'Nog geen berichten. Verstuur er een vanuit de editor.')}
        </p>
      ) : (
        <ol className="outbox">
          {list.map((o) => (
            <li key={o.id} className={o.status}>
              <InsightIc icon={o.icon} size={34} />
              <div className="grow">
                <div className="small strong">{tx(o.title)}</div>
                {(o.audience || o.customer) && (
                  <div className="xs muted">{o.audience ? t(`To ${o.audience.count} customers · ${tx(o.audience.label)}`, `Aan ${o.audience.count} klanten · ${tx(o.audience.label)}`) : t(`To ${o.customer!.name}`, `Aan ${o.customer!.name}`)}</div>
                )}
                <div className="outbox-status">
                  {o.status === 'scheduled' && (
                    <span className="badge info">
                      <Clock size={12} aria-hidden /> {t(`Scheduled for ${hm(o.sendAt)}`, `Ingepland voor ${hm(o.sendAt)}`)}
                    </span>
                  )}
                  {o.status === 'cancelled' && <span className="badge neutral">{t('Cancelled', 'Geannuleerd')}</span>}
                  {o.status === 'sent' && (
                    <>
                      <span className="badge neutral">
                        <Check size={12} aria-hidden /> {t(`Sent ${hm(o.sentAt ?? o.sendAt)}`, `Verstuurd ${hm(o.sentAt ?? o.sendAt)}`)}
                      </span>
                      {(o.pushed ?? 0) > 0 && (
                        <span className="badge pur">
                          <BellRing size={12} aria-hidden /> {t(`On ${o.pushed} phone${o.pushed === 1 ? '' : 's'}`, `Op ${o.pushed} telefoon${o.pushed === 1 ? '' : 's'}`)}
                        </span>
                      )}
                      {o.audience ? (
                        <span className={`badge ${o.audience.read > 0 ? 'ok' : 'warn'}`}>
                          <CheckCheck size={12} aria-hidden /> {t(`${o.audience.read} of ${o.audience.count} read`, `${o.audience.read} van ${o.audience.count} gelezen`)}
                        </span>
                      ) : o.readAt ? (
                        <span className="badge ok">
                          <CheckCheck size={12} aria-hidden /> {t(`Read ${hm(o.readAt)}`, `Gelezen ${hm(o.readAt)}`)}
                        </span>
                      ) : (
                        <span className="badge warn">{t('Not read yet', 'Nog niet gelezen')}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {o.status === 'scheduled' && onCancel && (
                <button className="btn btn-ghost btn-sm" onClick={() => onCancel(o.id)} aria-label={t(`Cancel “${tx(o.title)}”`, `Annuleer “${tx(o.title)}”`)}>
                  <X size={14} /> {t('Cancel', 'Annuleren')}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/**
 * The customer's visits to the app, newest first: when, how long, what they did, which screens they
 * looked at. One line per visit instead of one per click, so it reads at a glance.
 */
export function VisitsCard({ activity, online, now, limit = 5 }: { activity: Activity[]; online: boolean; now: number; limit?: number }) {
  const { t, tx, lang } = useI18n();
  const visits = groupVisits(activity);
  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB';
  const dayKey = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: DEMO_TZ }).format(ms);
  const day = (iso: string) => {
    const k = dayKey(new Date(iso).getTime());
    if (k === dayKey(now)) return t('Today', 'Vandaag');
    if (k === dayKey(now - 86_400_000)) return t('Yesterday', 'Gisteren');
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: DEMO_TZ }).format(new Date(iso));
  };
  const hm = (iso: string) => clock(iso, lang).slice(0, 5);
  return (
    <Card
      title={t('Visits to the app', 'Bezoeken aan de app')}
      sub={t(`What the customer did in ${brand.portal}, one line per visit`, `Wat de klant deed in ${brand.portal}, één regel per bezoek`)}
      action={
        <Link to="/staff/activity" className="btn btn-ghost btn-sm">
          {t('Full log', 'Volledig logboek')} <ArrowRight size={14} />
        </Link>
      }
      className="visits-card"
    >
      {visits.length === 0 ? (
        <p className="small muted staff-empty">
          <ActivityIcon size={18} aria-hidden /> {t(`No visits yet. They show here as soon as the customer opens ${brand.portal}.`, `Nog geen bezoeken. Ze verschijnen hier zodra de klant ${brand.portal} opent.`)}
        </p>
      ) : (
        <ol className="visits" aria-live="polite">
          {visits.slice(0, limit).map((v, i) => {
            const live = i === 0 && online;
            const mins = visitMinutes(v);
            return (
              <li key={v.id} className={live ? 'current' : undefined}>
                <div className="visit-when">
                  <span className="strong">
                    {day(v.start)} {hm(v.start)}
                  </span>
                  {live ? (
                    <span className="badge ok">
                      <i className="staff-dot on" aria-hidden /> {t('In the app now', 'Nu in de app')}
                    </span>
                  ) : (
                    <span className="xs muted">{mins < 1 ? t('Under a minute', 'Minder dan een minuut') : t(`${mins} min`, `${mins} min`)}</span>
                  )}
                </div>
                <div className="visit-what">
                  {v.actions.length === 0 ? (
                    <span className="small muted">{t('Looked around, changed nothing', 'Keek rond, wijzigde niets')}</span>
                  ) : (
                    <ul className="visit-actions">
                      {v.actions.map((a) => {
                        const Icon = KIND_ICON[a.kind];
                        return (
                          <li key={a.id}>
                            <span className="staff-feed-ic" aria-hidden>
                              <Icon size={15} />
                            </span>
                            <span className="small strong">{tx(a.text)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {v.screens.length > 0 && (
                    <span className="xs muted visit-screens">
                      <Eye size={13} aria-hidden /> {t('Looked at', 'Bekeek')}: {v.screens.map((s) => tx(s)).join(', ')}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
