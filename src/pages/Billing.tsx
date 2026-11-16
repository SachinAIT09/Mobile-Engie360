import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, CheckCircle2, Download, Eye, FileText, Landmark, Receipt, SlidersHorizontal, Wallet, Info } from 'lucide-react';
import { useI18n, type Text } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { contract, customer } from '../data/customer';
import { annualOverview, invoices, outstanding, payments, type Invoice } from '../data/billing';
import { costOf, monthly } from '../data/energy';
import { Card, DemoFlag, Kpi, Modal, PageHead, Seg } from '../components/ui';
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

/** Builds a simple printable invoice document and downloads it (demo stand-in for the PDF service). */
function downloadInvoice(inv: Invoice, tx: (x: Text) => string, eur: (v: number) => string, date: (iso: string) => string) {
  const rows = inv.lines.map((l) => `<tr><td>${tx(l.label)}</td><td style="text-align:right">${eur(l.amount)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.id}</title>
<style>body{font-family:Lato,Arial,sans-serif;color:#0b2240;max-width:640px;margin:40px auto;padding:0 20px}h1{color:#00aaff;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px 0;border-bottom:1px solid #e3e9f0}.tot td{font-weight:900;border:0}.demo{margin-top:40px;font-size:12px;color:#64758b;border:1px dashed #c9d4e0;padding:10px;border-radius:8px}</style></head>
<body><h1>${brand.name}</h1><p><b>${tx(inv.period)}</b><br>${inv.id}</p>
<p>${customer.firstName} ${customer.lastName}<br>${customer.address.street}<br>${customer.address.postcode} ${customer.address.city}<br>Customer no. ${customer.customerNo}</p>
<p>Issued ${date(inv.issued)} · Due ${date(inv.due)}</p>
<table>${rows}<tr class="tot"><td>Total</td><td style="text-align:right">${eur(inv.amount)}</td></tr></table>
<p class="demo">DEMO DOCUMENT. Prototype with sample data. Not a real ${brand.name} invoice.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${inv.id}-DEMO.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function InvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const { t, tx, eur, date } = useI18n();
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
            {t('Explain with assistant', 'Uitleg van assistent')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              downloadInvoice(inv, tx, eur, date);
              toast(t('Invoice downloaded (demo document)', 'Nota gedownload (demodocument)'));
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
    </Modal>
  );
}

export default function Billing() {
  const { chart: c } = useTheme();
  const { t, tx, eur, date, num } = useI18n();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const installment = contract.installment;
  const [pending, setPending] = useState<number | null>(null);
  const [adjustState, setAdjustOpen] = useState(false);
  // ?adjust=1 (from insights, the dashboard or the assistant) opens the modal.
  const adjustOpen = adjustState || params.get('adjust') === '1';
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [showAll, setShowAll] = useState(false);

  const closeAdjust = () => {
    setAdjustOpen(false);
    if (params.has('adjust')) setParams({}, { replace: true });
  };

  const list = invoices.filter((i) => filter === 'all' || i.kind === filter);
  const shown = showAll ? list : list.slice(0, 6);

  // Contract-year view: estimated monthly cost vs the advance paid.
  const yearChart = useMemo(
    () =>
      monthly.slice(4).map((m) => ({
        name: tx(m.label),
        cost: Math.round(costOf(m.electricity, m.gas)),
      })),
    [tx],
  );

  const paidPct = Math.round((annualOverview.paidSoFar / annualOverview.estimatedTotal) * 100);

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
          foot={pending ? <span className="badge info">{t('New', 'Nieuw')}: {eur(pending, 0)} {t('from Dec', 'vanaf dec')}</span> : <span>{t('Direct debit on the', 'Incasso op de')} {customer.collectionDay}{t('th', 'e')}</span>}
        />
        <Kpi icon={CalendarClock} tone="ink" label={t('Outstanding', 'Openstaand')} value={eur(outstanding.reduce((s, i) => s + i.amount, 0), 0)} foot={<span className="badge info">{t('Nothing overdue', 'Niets achterstallig')}</span>} />
        <Kpi icon={Landmark} tone="eur" label={t('Paid this contract year', 'Betaald dit contractjaar')} value={eur(annualOverview.paidSoFar, 0)} foot={<span>{t('8 of 12 installments', '8 van 12 termijnen')}</span>} />
        <Kpi icon={Receipt} tone="gas" label={t('Expected settlement', 'Verwachte eindafrekening')} value={`+${eur(annualOverview.expectedSettlement, 0)}`} foot={<span>{t('to pay in March 2027', 'bijbetalen in maart 2027')}</span>} />
      </div>

      <div className="grid g-main mt">
        <Card title={t('Annual cost overview', 'Jaaroverzicht kosten')} sub={tx(annualOverview.year)}>
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={yearChart} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} />
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

        <div className="stack">
          <Card title={t('Contract year progress', 'Voortgang contractjaar')}>
            <div className="row between small">
              <span className="muted">{t('Paid so far', 'Tot nu toe betaald')}</span>
              <b className="num">
                {eur(annualOverview.paidSoFar, 0)} / {eur(annualOverview.estimatedTotal, 0)}
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
          </Card>
          <Card title={t('Outstanding payments', 'Openstaande betalingen')}>
            {outstanding.map((o) => (
              <div key={o.id} className="list-row" style={{ paddingTop: 0 }}>
                <span className="kpi-ic el">
                  <CalendarClock size={18} />
                </span>
                <div className="grow">
                  <div className="strong small">{tx(o.period)}</div>
                  <div className="xs muted">
                    {t('Collected on', 'Afschrijving op')} {date(o.due, { day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="strong num">{eur(o.amount)}</div>
                  <StatusBadge s={o.status} />
                </div>
              </div>
            ))}
            <div className="row small muted" style={{ gap: 8 }}>
              <Landmark size={15} /> {tx(customer.paymentMethod)} · {customer.iban.replace(/\d{4} \d{2}$/, '•••• ••')}
            </div>
          </Card>
        </div>
      </div>

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
                <th>{t('Status', 'Status')}</th>
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
                  <td className="r num strong">{eur(inv.amount)}</td>
                  <td>
                    <StatusBadge s={inv.status} />
                  </td>
                  <td className="r">
                    <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                      <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setViewing(inv)} aria-label={t(`View ${inv.id}`, `Bekijk ${inv.id}`)}>
                        <Eye size={16} />
                      </button>
                      <button
                        className="icon-btn hide-m"
                        style={{ width: 36, height: 36 }}
                        onClick={() => {
                          downloadInvoice(inv, tx, eur, date);
                          toast(t('Invoice downloaded (demo document)', 'Nota gedownload (demodocument)'));
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
        {list.length > 6 && (
          <div className="row mt-s" style={{ justifyContent: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? t('Show less', 'Toon minder') : t(`Show all ${list.length}`, `Toon alle ${list.length}`)}
            </button>
          </div>
        )}
      </Card>

      <Card className="mt" title={t('Payment history', 'Betaalgeschiedenis')} sub={t('Received payments', 'Ontvangen betalingen')}>
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
      </Card>

      <div className="row mt" style={{ justifyContent: 'center' }}>
        <DemoFlag />
      </div>

      {adjustOpen && (
        <InstallmentModal
          current={pending ?? installment}
          onClose={closeAdjust}
          onSave={(v) => {
            setPending(v);
            closeAdjust();
            toast(t(`Installment changed to €${v} from December`, `Termijnbedrag gewijzigd naar €${v} vanaf december`));
          }}
        />
      )}
      {viewing && <InvoiceModal inv={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
