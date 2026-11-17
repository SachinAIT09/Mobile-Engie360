import { useLive } from '../api/live';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, CheckCircle2, Download, Eye, FileText, Landmark, Receipt, SlidersHorizontal, Wallet, Info } from 'lucide-react';
import { PaySheet } from '../components/PaySheet';
import { downloadPdf } from '../lib/pdf';
import { useI18n, type Text } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { contract, customer } from '../data/customer';
import { annualOverview, withPayments, type Invoice, type Payment } from '../data/billing';
import { costOf, monthly } from '../data/energy';
import { Card, Expander, Kpi, Modal, PageHead, Seg } from '../components/ui';
import { useToast } from '../components/toast';
import { usePortalAssistant } from '../assistant/portalContext';
import { brand } from '../brand';

type Filter = 'all' | 'installment' | 'annual';

function StatusBadge({ s }: { s: Invoice['status'] }) {
  const { t } = useI18n();
  if (s === 'paid')
    return (
      <span className="badge ok">
        <CheckCircle2 size={13} /> {t('Paid', 'Betaald')}
      </span>
    );
  if (s === 'scheduled') return <span className="badge info">{t('Scheduled', 'Ingepland')}</span>;
  return <span className="badge danger">{t('Open', 'Openstaand')}</span>;
}

type Fmt = { t: (en: string, nl: string) => string; tx: (x: Text) => string; eur: (v: number) => string; date: (iso: string, o?: Intl.DateTimeFormatOptions) => string };

const LONG_DATE = { day: 'numeric', month: 'long', year: 'numeric' } as const;
const maskedIban = () => customer.iban.replace(/\d{4} \d{2}$/, '•••• ••');

/** What every downloaded document shares: the wordmark, the customer's address and the footer. */
const letterhead = (t: Fmt['t']) => ({
  brand: brand.name,
  tagline: brand.portal,
  address: [`${customer.firstName} ${customer.lastName}`, customer.address.street, `${customer.address.postcode} ${customer.address.city}`],
  footer: [
    `${brand.name} · ${brand.portal}`,
    t(`Questions about this document? Ask ${brand.assistant.name} in the app, or look under Billing.`, `Vragen over dit document? Stel ze aan ${brand.assistant.name} in de app, of kijk onder Betalen.`),
  ],
});

/** The invoice as a PDF download, laid out like a paper invoice. */
function downloadInvoice(inv: Invoice, { t, tx, eur, date }: Fmt, autopay: boolean) {
  const paid = inv.status === 'paid';
  const due = date(inv.due, LONG_DATE);
  downloadPdf(inv.id, {
    ...letterhead(t),
    title: inv.id,
    kind: t('Invoice', 'Nota'),
    status: paid ? { label: t('Paid', 'Betaald'), tone: 'ok' } : autopay ? { label: t('Scheduled', 'Ingepland'), tone: 'info' } : { label: t('Open', 'Openstaand'), tone: 'warn' },
    details: [
      { label: t('Invoice number', 'Notanummer'), value: inv.id },
      { label: t('Invoice date', 'Notadatum'), value: date(inv.issued, LONG_DATE) },
      { label: t('Due date', 'Vervaldatum'), value: due },
      { label: t('Customer number', 'Klantnummer'), value: customer.customerNo },
    ],
    heading: `${inv.kind === 'annual' ? t('Annual statement', 'Jaarnota') : t('Installment invoice', 'Termijnnota')} · ${tx(inv.period)}`,
    meta: [
      `${tx(contract.product)} · ${t('Supply address', 'Leveringsadres')}: ${customer.address.street}, ${customer.address.postcode} ${customer.address.city}`,
      `EAN ${t('electricity', 'stroom')} ${contract.electricity.ean} · EAN gas ${contract.gas.ean}`,
    ],
    columns: [t('Description', 'Omschrijving'), t('Amount', 'Bedrag')],
    rows: inv.lines.map((l) => ({ label: tx(l.label), value: eur(l.amount) })),
    total: { label: inv.kind === 'annual' ? t('To pay', 'Te betalen') : t('Total', 'Totaal'), value: eur(inv.amount) },
    totalNote: t(`Amounts include 21% VAT (${eur((inv.amount * 21) / 121)}).`, `Bedragen zijn inclusief 21% btw (${eur((inv.amount * 21) / 121)}).`),
    callout: paid
      ? { title: t('Paid', 'Betaald'), text: t(`We received your payment${inv.paidOn ? ` on ${date(inv.paidOn, LONG_DATE)}` : ''}. You do not need to do anything.`, `We hebben je betaling${inv.paidOn ? ` op ${date(inv.paidOn, LONG_DATE)}` : ''} ontvangen. Je hoeft niets te doen.`) }
      : autopay
        ? { title: t('Automatic payment', 'Automatisch betalen'), text: t(`We collect ${eur(inv.amount)} on ${due} from your account ${maskedIban()}. You do not need to do anything.`, `We schrijven ${eur(inv.amount)} op ${due} af van je rekening ${maskedIban()}. Je hoeft niets te doen.`) }
        : { title: t(`Please pay by ${due}`, `Betaal uiterlijk ${due}`), text: t(`Pay this invoice in the ${brand.portal} app under Billing, with iDEAL, your bank account or a card.`, `Betaal deze nota in de ${brand.portal}-app onder Betalen, met iDEAL, je bankrekening of een kaart.`) },
  });
}

/** The payment receipt as a PDF download. */
function downloadReceipt(p: Payment, inv: Invoice, { t, tx, eur, date }: Fmt) {
  downloadPdf(p.id, {
    ...letterhead(t),
    title: p.id,
    kind: t('Payment receipt', 'Betaalbewijs'),
    status: { label: t('Paid', 'Betaald'), tone: 'ok' },
    details: [
      { label: t('Reference', 'Kenmerk'), value: p.id },
      { label: t('Payment date', 'Betaaldatum'), value: date(p.date, LONG_DATE) },
      { label: t('Paid with', 'Betaald met'), value: tx(p.method) },
      { label: t('Customer number', 'Klantnummer'), value: customer.customerNo },
    ],
    heading: t(`Payment for ${tx(inv.period)}`, `Betaling voor ${tx(inv.period)}`),
    meta: [`${t('Invoice number', 'Notanummer')} ${inv.id}`],
    columns: [t('Description', 'Omschrijving'), t('Amount', 'Bedrag')],
    rows: [{ label: `${inv.kind === 'annual' ? t('Annual statement', 'Jaarnota') : t('Installment invoice', 'Termijnnota')} ${tx(inv.period)}`, value: eur(inv.amount) }],
    total: { label: t('Amount paid', 'Betaald bedrag'), value: eur(p.amount) },
    callout: { title: t('Payment received', 'Betaling ontvangen'), text: t('Thank you for your payment. This invoice is settled in full. Keep this receipt for your records.', 'Bedankt voor je betaling. Deze nota is volledig voldaan. Bewaar dit betaalbewijs voor je administratie.') },
  });
}

function InstallmentModal({ current, onClose, onSave }: { current: number; onClose: () => void; onSave: (v: number) => void }) {
  const { t, eur } = useI18n();
  const [value, setValue] = useState(contract.advisedInstallment);
  const { min, max } = contract.installmentRange;
  const remaining = 4; // Nov–Feb left in the contract year
  const settlement = annualOverview.estimatedTotal - (annualOverview.paidSoFar + value * remaining);
  const pos = ((contract.advisedInstallment - min) / (max - min)) * 100;

  return (
    <Modal
      title={t('Adjust monthly installment', 'Termijnbedrag aanpassen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            {t('Cancel', 'Annuleren')}
          </button>
          <button className="btn btn-primary" disabled={value === current} onClick={() => onSave(value)}>
            {t('Confirm', 'Bevestigen')} {eur(value, 0)}
          </button>
        </>
      }
    >
      <p className="small muted">
        {t('Your current installment is', 'Je huidige termijnbedrag is')} <b>{eur(current)}</b>. {t('Choose an amount between', 'Kies een bedrag tussen')} {eur(min, 0)} {t('and', 'en')} {eur(max, 0)}.
      </p>
      <div className="row" style={{ justifyContent: 'center', margin: '22px 0 8px', alignItems: 'baseline', gap: 6 }}>
        <span className="num" style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.02em' }}>
          {eur(value, 0)}
        </span>
        <span className="muted strong">{t('/ month', '/ maand')}</span>
      </div>
      <div style={{ position: 'relative', padding: '16px 0 4px' }}>
        <span className="badge green xs" style={{ position: 'absolute', top: -10, left: `calc(${pos}% - 46px)` }}>
          {t('Advised', 'Advies')} {eur(contract.advisedInstallment, 0)}
        </span>
        <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} aria-label={t('Installment amount', 'Termijnbedrag')} />
        <div className="row between xs muted">
          <span>{eur(min, 0)}</span>
          <span>{eur(max, 0)}</span>
        </div>
      </div>
      <div className="row wrap mt-s" style={{ gap: 6 }}>
        {[contract.installment, contract.advisedInstallment, 210].map((v) => (
          <button key={v} className={`btn btn-sm ${v === value ? 'btn-dark' : 'btn-outline'}`} onClick={() => setValue(v)}>
            {eur(v, 0)}
          </button>
        ))}
      </div>
      <div className="card flat mt" style={{ background: 'var(--bg)', border: 0, padding: 16 }}>
        <div className="row between small">
          <span className="muted">{t('Expected at annual statement (Mar 2027)', 'Verwacht bij jaarnota (mrt 2027)')}</span>
          <b className={`num ${settlement > 0 ? 'up' : 'down'}`}>
            {settlement > 0 ? t('Pay', 'Bijbetalen') + ' ' + eur(settlement, 0) : t('Refund', 'Terug') + ' ' + eur(-settlement, 0)}
          </b>
        </div>
        <div className="row between small mt-s">
          <span className="muted">{t('Takes effect', 'Ingangsdatum')}</span>
          <b>{t('December 2026 installment', 'Termijn december 2026')}</b>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceModal({ inv, onClose, onPay }: { inv: Invoice; onClose: () => void; onPay: () => void }) {
  const { t, tx, eur, date } = useI18n();
  const { autopay } = useLive().pay;
  const toast = useToast();
  const { ask } = usePortalAssistant();
  return (
    <Modal
      title={inv.kind === 'annual' ? t('Annual statement', 'Jaarnota') : t('Installment invoice', 'Termijnnota')}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-outline"
            onClick={() => {
              onClose();
              ask(t('Can you explain my latest invoice?', 'Kun je mijn laatste nota uitleggen?'));
            }}
          >
            {t(`Explain with ${brand.assistant.name}`, `Uitleg van ${brand.assistant.name}`)}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              downloadInvoice(inv, { t, tx, eur, date }, autopay);
              toast(t('Invoice downloaded', 'Nota gedownload'));
            }}
          >
            <Download size={16} /> {t('Download', 'Download')}
          </button>
        </>
      }
    >
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="strong">{tx(inv.period)}</div>
          <div className="xs muted">{inv.id}</div>
        </div>
        <StatusBadge s={inv.status} />
      </div>
      <dl className="kv mt">
        <dt>{t('Issued', 'Datum')}</dt>
        <dd>{date(inv.issued)}</dd>
        <dt>{t('Due', 'Vervaldatum')}</dt>
        <dd>{date(inv.due)}</dd>
        {inv.paidOn && (
          <>
            <dt>{t('Paid on', 'Betaald op')}</dt>
            <dd>{date(inv.paidOn)}</dd>
          </>
        )}
      </dl>
      <div className="list mt" style={{ borderTop: '1px solid var(--line)' }}>
        {inv.lines.map((l) => (
          <div key={l.label.en} className="list-row small">
            <span className="grow">{tx(l.label)}</span>
            <span className="num">{eur(l.amount)}</span>
          </div>
        ))}
        <div className="list-row">
          <span className="grow strong">{inv.kind === 'annual' ? t('To pay', 'Te betalen') : t('Total', 'Totaal')}</span>
          <span className="num strong" style={{ fontSize: 18 }}>
            {eur(inv.amount)}
          </span>
        </div>
      </div>
      {inv.status !== 'paid' && (
        <button className="btn btn-primary mt" style={{ width: '100%' }} onClick={onPay}>
          {t('Pay now', 'Nu betalen')}
        </button>
      )}
    </Modal>
  );
}

export default function Billing() {
  const { chart: c } = useTheme();
  const { t, tx, eur, date, num } = useI18n();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const live = useLive();
  const installment = live.installment.current;
  const pending = live.installment.pending?.amount ?? null;
  const [adjustState, setAdjustOpen] = useState(false);
  // ?adjust=1 (from insights, the dashboard or the assistant) opens the modal.
  const adjustOpen = adjustState || params.get('adjust') === '1';
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [confirmAutopay, setConfirmAutopay] = useState(false);
  // Invoices and payments as they stand now: paid in the app, collected automatically, or open.
  const { autopay } = live.pay;
  const { invoices, payments, outstanding } = useMemo(() => withPayments(live.pay), [live.pay]);
  const due = outstanding.reduce((s, i) => s + i.amount, 0);
  const paidInApp = live.pay.paid.reduce((s, p) => s + p.amount, 0);
  const paidSoFar = annualOverview.paidSoFar + paidInApp;

  const closeAdjust = () => {
    setAdjustOpen(false);
    if (params.has('adjust')) setParams({}, { replace: true });
  };

  const list = invoices.filter((i) => filter === 'all' || i.kind === filter);
  const shown = showAll ? list : list.slice(0, 3);

  // Contract-year view: estimated monthly cost vs the advance paid.
  const yearChart = useMemo(
    () =>
      monthly.slice(4).map((m) => ({
        name: tx(m.label),
        cost: Math.round(costOf(m.electricity, m.gas)),
      })),
    [tx],
  );

  const paidPct = Math.round((paidSoFar / annualOverview.estimatedTotal) * 100);

  return (
    <>
      <PageHead eyebrow={t('Bills & payments', 'Nota’s & betalingen')} title={t('Your bills and payments', 'Je nota’s en betalingen')} sub={t('Advance payments, invoices and your annual cost overview.', 'Voorschotten, nota’s en je jaaroverzicht van kosten.')}>
        <button className="btn btn-primary" onClick={() => setAdjustOpen(true)}>
          <SlidersHorizontal size={17} /> {t('Adjust installment', 'Termijnbedrag aanpassen')}
        </button>
      </PageHead>

      <div className="grid g-4">
        <Kpi
          icon={Wallet}
          tone="el"
          label={t('Monthly installment', 'Termijnbedrag')}
          value={eur(installment, 0)}
          foot={pending ? <span className="badge info">{t('New', 'Nieuw')}: {eur(pending, 0)} {t('from Dec', 'vanaf dec')}</span> : autopay ? <span>{t('Direct debit on the', 'Incasso op de')} {customer.collectionDay}{t('th', 'e')}</span> : <span>{t('You pay each invoice yourself', 'Je betaalt elke nota zelf')}</span>}
        />
        <Kpi icon={CalendarClock} tone="ink" label={t('Outstanding', 'Openstaand')} value={eur(due, 0)} foot={due === 0 ? <span className="badge ok">{t('All paid', 'Alles betaald')}</span> : <span className="badge info">{t('Nothing overdue', 'Niets achterstallig')}</span>} />
        <Kpi icon={Landmark} tone="eur" label={t('Paid this contract year', 'Betaald dit contractjaar')} value={eur(paidSoFar, 0)} foot={<span>{t(`${8 + live.pay.paid.length} of 12 installments`, `${8 + live.pay.paid.length} van 12 termijnen`)}</span>} />
        <Kpi icon={Receipt} tone="gas" label={t('Expected settlement', 'Verwachte eindafrekening')} value={`+${eur(annualOverview.expectedSettlement, 0)}`} foot={<span>{t('to pay in March 2027', 'bijbetalen in maart 2027')}</span>} />
      </div>

      <Card className="mt" title={t('Outstanding payments', 'Openstaande betalingen')}>
        {outstanding.length === 0 && (
          <div className="row" style={{ gap: 12 }}>
            <span className="kpi-ic eur">
              <CheckCircle2 size={18} />
            </span>
            <div className="grow">
              <div className="strong small">{t('You are all paid up', 'Je hebt alles betaald')}</div>
              <div className="xs muted">{t('Your next invoice arrives in December.', 'Je volgende nota komt in december.')}</div>
            </div>
          </div>
        )}
        {outstanding.map((o) => (
          <div key={o.id} className="pay-due">
            <div className="row" style={{ gap: 12 }}>
              <span className="kpi-ic el">
                <CalendarClock size={18} />
              </span>
              <div className="grow">
                <div className="strong small">{tx(o.period)}</div>
                <div className="xs muted">
                  {autopay ? t('Collected on', 'Afschrijving op') : t('Due on', 'Betalen voor')} {date(o.due, { day: 'numeric', month: 'long' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="strong num">{eur(o.amount)}</div>
                <StatusBadge s={o.status} />
              </div>
            </div>
            <button className={`btn ${autopay ? 'btn-outline' : 'btn-primary'} mt-s`} style={{ width: '100%' }} onClick={() => setPaying(o)}>
              {autopay ? t('Pay now instead', 'Nu al betalen') : t('Pay now', 'Nu betalen')}
            </button>
          </div>
        ))}
        <div className="autopay-row">
          <div className="grow">
            <div className="small strong">{t('Automatic payment', 'Automatisch betalen')}</div>
            <div className="xs muted">
              {autopay ? t(`On the ${customer.collectionDay}th from ${maskedIban()}`, `Op de ${customer.collectionDay}e van ${maskedIban()}`) : t('Off. You pay each invoice yourself.', 'Uit. Je betaalt elke nota zelf.')}
            </div>
          </div>
          <button className={`switch${autopay ? ' on' : ''}`} role="switch" aria-checked={autopay} aria-label={t('Automatic payment', 'Automatisch betalen')} onClick={() => setConfirmAutopay(true)} />
        </div>
      </Card>

      <Card
        className="mt"
        id="invoices"
        title={t('Invoices', 'Nota’s')}
        sub={t(`${invoices.length} documents in the last 12 months`, `${invoices.length} documenten in de afgelopen 12 maanden`)}
        action={
          <Seg
            label={t('Filter', 'Filter')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('All', 'Alle') },
              { value: 'installment', label: t('Installments', 'Termijnnota’s') },
              { value: 'annual', label: t('Annual', 'Jaarnota') },
            ]}
          />
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Invoice', 'Nota')}</th>
                <th className="hide-m">{t('Number', 'Nummer')}</th>
                <th className="hide-m">{t('Date', 'Datum')}</th>
                <th className="r">{t('Amount', 'Bedrag')}</th>
                <th className="r">
                  <span className="sr-only">{t('Actions', 'Acties')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span className="row" style={{ gap: 10 }}>
                      <FileText size={17} color={inv.kind === 'annual' ? '#7b61ff' : '#64758b'} />
                      <span className="strong">{tx(inv.period)}</span>
                    </span>
                  </td>
                  <td className="hide-m muted">{inv.id}</td>
                  <td className="hide-m">{date(inv.issued)}</td>
                  <td className="r">
                    <div className="num strong">{eur(inv.amount)}</div>
                    <StatusBadge s={inv.status} />
                  </td>
                  <td className="r">
                    <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                      <button className="icon-btn" style={{ width: 44, height: 44 }} onClick={() => setViewing(inv)} aria-label={t(`View ${inv.id}`, `Bekijk ${inv.id}`)}>
                        <Eye size={16} />
                      </button>
                      <button
                        className="icon-btn hide-m"
                        style={{ width: 44, height: 44 }}
                        onClick={() => {
                          downloadInvoice(inv, { t, tx, eur, date }, autopay);
                          live.track('invoice_download', inv.id);
                          toast(t('Invoice downloaded', 'Nota gedownload'));
                        }}
                        aria-label={t(`Download ${inv.id}`, `Download ${inv.id}`)}
                      >
                        <Download size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length > 3 && (
          <div className="row mt-s" style={{ justifyContent: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? t('Show less', 'Toon minder') : t(`Show all ${list.length}`, `Toon alle ${list.length}`)}
            </button>
          </div>
        )}
      </Card>

      <Card className="mt" title={t('Annual cost overview', 'Jaaroverzicht kosten')} sub={tx(annualOverview.year)}>
        <div style={{ height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={yearChart} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} interval={1} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={50} tickFormatter={(v: number) => `€${v}`} />
              <Tooltip
                cursor={{ fill: c.cursor }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="chart-tip">
                      <b>{label}</b>
                      {t('Actual cost', 'Werkelijke kosten')}: {eur(Number(payload[0]?.value))}
                      <br />
                      {t('Installment', 'Termijn')}: {eur(installment)}
                    </div>
                  ) : null
                }
              />
              <ReferenceLine y={installment} stroke={c.ink} strokeDasharray="5 4" label={{ value: t('Installment', 'Termijn'), position: 'insideTopRight', fontSize: 11, fill: c.ink }} />
              <Bar dataKey="cost" fill="#00aaff" radius={[5, 5, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="small muted mt-s">
          <Info size={14} style={{ verticalAlign: -2 }} /> {t('Summer months cost less than your installment, winter months more. It evens out at the annual statement.', 'In de zomer betaal je meer dan je verbruikt, in de winter minder. Dat verrekenen we bij de jaarnota.')}
        </p>
      </Card>


      <div className="mt">
      <Expander title={t('Contract year progress', 'Voortgang contractjaar')} meta={<span className="xs muted num">{paidPct}%</span>}>
        <div className="row between small">
          <span className="muted">{t('Paid so far', 'Tot nu toe betaald')}</span>
          <b className="num">
            {eur(paidSoFar, 0)} / {eur(annualOverview.estimatedTotal, 0)}
          </b>
        </div>
        <div className="bar mt-s">
          <span style={{ width: `${paidPct}%` }} />
        </div>
        <dl className="kv mt">
          <dt>{t('Estimated yearly cost', 'Geschatte jaarkosten')}</dt>
          <dd className="num">{eur(annualOverview.estimatedTotal, 0)}</dd>
          <dt>{t('Installments total', 'Totaal termijnen')}</dt>
          <dd className="num">{eur(annualOverview.installmentsTotal, 0)}</dd>
          <dt>{t('Difference', 'Verschil')}</dt>
          <dd className="num up">+{eur(annualOverview.expectedSettlement, 0)}</dd>
        </dl>
      </Expander>
      </div>

      <Expander title={t('Payment history', 'Betaalgeschiedenis')} meta={<span className="xs muted">{num(payments.length)} {t('payments', 'betalingen')}</span>}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Date', 'Datum')}</th>
                <th className="hide-m">{t('Description', 'Omschrijving')}</th>
                <th className="hide-m">{t('Method', 'Methode')}</th>
                <th className="r">{t('Amount', 'Bedrag')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 8).map((p) => (
                <tr key={p.id}>
                  <td>{date(p.date)}</td>
                  <td className="hide-m muted">{p.invoiceId}</td>
                  <td className="hide-m">{tx(p.method)}</td>
                  <td className="r num strong">{eur(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="xs muted mt-s">
          {t('Total received in the last 12 months:', 'Totaal ontvangen in de afgelopen 12 maanden:')} <b className="num">{eur(payments.reduce((s, p) => s + p.amount, 0))}</b> · {num(payments.length)} {t('payments', 'betalingen')}
        </p>
      </Expander>


      {adjustOpen && (
        <InstallmentModal
          current={pending ?? installment}
          onClose={closeAdjust}
          onSave={(v) => {
            closeAdjust();
            live.setInstallment(v).then(
              () => toast(t(`Installment changed to €${v} from December`, `Termijnbedrag gewijzigd naar €${v} vanaf december`)),
              () => toast(t('Could not save the installment. Please try again.', 'Het termijnbedrag kon niet worden opgeslagen. Probeer het opnieuw.')),
            );
          }}
        />
      )}
      {viewing && (
        <InvoiceModal
          inv={invoices.find((i) => i.id === viewing.id) ?? viewing}
          onClose={() => setViewing(null)}
          onPay={() => {
            setPaying(viewing);
            setViewing(null);
          }}
        />
      )}
      {paying && (
        <PaySheet
          inv={paying}
          onClose={() => setPaying(null)}
          onReceipt={(p) => {
            downloadReceipt(p, paying, { t, tx, eur, date });
            toast(t('Receipt downloaded', 'Betaalbewijs gedownload'));
          }}
        />
      )}
      {confirmAutopay && (
        <Modal
          title={autopay ? t('Switch automatic payment off?', 'Automatisch betalen uitzetten?') : t('Switch automatic payment on?', 'Automatisch betalen aanzetten?')}
          onClose={() => setConfirmAutopay(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setConfirmAutopay(false)}>
                {t('Cancel', 'Annuleren')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  live.setAutopay(!autopay);
                  setConfirmAutopay(false);
                  toast(autopay ? t('Automatic payment is off', 'Automatisch betalen staat uit') : t('Automatic payment is on', 'Automatisch betalen staat aan'));
                }}
              >
                {autopay ? t('Switch off', 'Uitzetten') : t('Switch on', 'Aanzetten')}
              </button>
            </>
          }
        >
          <p className="small">
            {autopay
              ? t('We will no longer collect your invoices automatically. You pay each one yourself in the app before its due date.', 'We schrijven je nota’s niet meer automatisch af. Je betaalt elke nota zelf in de app, vóór de vervaldatum.')
              : t(`We collect each invoice on the ${customer.collectionDay}th from ${maskedIban()}. You don’t have to do anything.`, `We schrijven elke nota op de ${customer.collectionDay}e af van ${maskedIban()}. Je hoeft niets te doen.`)}
          </p>
        </Modal>
      )}
    </>
  );
}
