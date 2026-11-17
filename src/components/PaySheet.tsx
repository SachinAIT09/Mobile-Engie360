import { useState } from 'react';
import { CreditCard, Download, Landmark, Lock, Smartphone, type LucideIcon } from 'lucide-react';
import type { PayMethod } from '../../shared/contract';
import type { Invoice, Payment } from '../data/billing';
import { customer } from '../data/customer';
import { useLive } from '../api/live';
import { useI18n } from '../lib/i18n';
import { Modal } from './ui';

const BANKS = ['ABN AMRO', 'ING', 'Rabobank', 'SNS', 'ASN Bank', 'bunq'];
/** How long "Processing…" stays up, so the confirmation does not flash by. */
const PROCESSING_MS = 1600;

type Step = 'review' | 'processing' | 'done';

/**
 * Pay an invoice from the app: choose a method, a short "processing" moment, then an animated tick.
 * The payment is recorded on our own server only; card details never leave this sheet.
 */
export function PaySheet({ inv, onClose, onReceipt }: { inv: Invoice; onClose: () => void; onReceipt: (p: Payment) => void }) {
  const { t, tx, eur, date } = useI18n();
  const { payInvoice } = useLive();
  const [step, setStep] = useState<Step>('review');
  const [method, setMethod] = useState<PayMethod>('ideal');
  const [bank, setBank] = useState(BANKS[0]!);
  const [card, setCard] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [failed, setFailed] = useState(false);

  const cardOk = card.replace(/\D/g, '').length >= 12;
  const ready = method !== 'card' || cardOk;
  const maskedIban = customer.iban.replace(/\d{4} \d{2}$/, '•••• ••');

  const methods: { id: PayMethod; icon: LucideIcon; label: string; desc: string }[] = [
    { id: 'ideal', icon: Smartphone, label: 'iDEAL', desc: t('Pay with your own bank app', 'Betaal met de app van je bank') },
    { id: 'account', icon: Landmark, label: t('My bank account', 'Mijn bankrekening'), desc: maskedIban },
    { id: 'card', icon: CreditCard, label: t('Debit or credit card', 'Betaalpas of creditcard'), desc: t('Visa, Mastercard, Maestro', 'Visa, Mastercard, Maestro') },
  ];

  const pay = async () => {
    setFailed(false);
    setStep('processing');
    try {
      const [p] = await Promise.all([payInvoice(inv.id, method, method === 'ideal' ? bank : undefined), new Promise((r) => setTimeout(r, PROCESSING_MS))]);
      setPayment(p);
      setStep('done');
    } catch {
      setFailed(true);
      setStep('review');
    }
  };

  const title = step === 'done' ? t('Payment received', 'Betaling ontvangen') : t('Pay invoice', 'Nota betalen');

  return (
    <Modal
      sheet
      title={title}
      // While the payment is being processed the sheet stays put.
      onClose={step === 'processing' ? () => undefined : onClose}
      footer={
        step === 'review' ? (
          <button className="btn btn-primary pay-cta" disabled={!ready} onClick={pay}>
            <Lock size={16} /> {t('Pay', 'Betaal')} {eur(inv.amount)}
          </button>
        ) : step === 'done' && payment ? (
          <>
            <button className="btn btn-outline" onClick={() => onReceipt(payment)}>
              <Download size={16} /> {t('Receipt', 'Betaalbewijs')}
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              {t('Done', 'Klaar')}
            </button>
          </>
        ) : undefined
      }
    >
      {step === 'review' && (
        <>
          <div className="pay-amount">
            <span className="small muted strong">{tx(inv.period)}</span>
            <span className="num">{eur(inv.amount)}</span>
            <span className="xs muted">
              {inv.id} · {t('due', 'vervalt')} {date(inv.due, { day: 'numeric', month: 'long' })}
            </span>
          </div>
          <div className="pay-methods" role="radiogroup" aria-label={t('Payment method', 'Betaalmethode')}>
            {methods.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className={`pay-method${method === m.id ? ' on' : ''}`} onClick={() => setMethod(m.id)}>
                <span className="kpi-ic el">
                  <m.icon size={18} />
                </span>
                <span className="grow">
                  <b>{m.label}</b>
                  <span className="xs muted">{m.desc}</span>
                </span>
                <span className="pay-radio" aria-hidden />
              </button>
            ))}
          </div>
          {method === 'ideal' && (
            <label className="field mt">
              {t('Your bank', 'Je bank')}
              <select className="input" value={bank} onChange={(e) => setBank(e.target.value)}>
                {BANKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
          )}
          {method === 'card' && (
            <div className="stack mt" style={{ gap: 10 }}>
              <label className="field">
                {t('Card number', 'Kaartnummer')}
                <input className="input" inputMode="numeric" autoComplete="off" placeholder="1234 5678 9012 3456" value={card} onChange={(e) => setCard(e.target.value)} />
              </label>
              <div className="duo">
                <label className="field">
                  {t('Expiry', 'Vervaldatum')}
                  <input className="input" inputMode="numeric" autoComplete="off" placeholder={t('MM/YY', 'MM/JJ')} />
                </label>
                <label className="field">
                  CVC
                  <input className="input" inputMode="numeric" autoComplete="off" placeholder="123" />
                </label>
              </div>
            </div>
          )}
          {failed && (
            <p className="small up mt-s" role="alert">
              {t('The payment did not go through. Please try again.', 'De betaling is niet gelukt. Probeer het opnieuw.')}
            </p>
          )}
        </>
      )}

      {step === 'processing' && (
        <div className="pay-state" role="status" aria-live="polite">
          <span className="pay-spinner" aria-hidden />
          <b>{t('Processing your payment…', 'Je betaling wordt verwerkt…')}</b>
          <span className="small muted">{t('This takes a few seconds. Keep this screen open.', 'Dit duurt een paar seconden. Houd dit scherm open.')}</span>
        </div>
      )}

      {step === 'done' && payment && (
        <div className="pay-state" role="status" aria-live="polite">
          <svg className="pay-tick" viewBox="0 0 72 72" aria-hidden>
            <circle cx="36" cy="36" r="32" />
            <path d="M22 37.5 32 47 51 27" />
          </svg>
          <span className="num pay-paid">{eur(payment.amount)}</span>
          <b>{t(`Thank you, ${customer.firstName}. Your payment is in.`, `Bedankt, ${customer.firstName}. Je betaling is binnen.`)}</b>
          <dl className="kv small pay-details">
            <dt>{t('Invoice', 'Nota')}</dt>
            <dd>{tx(inv.period)}</dd>
            <dt>{t('Paid with', 'Betaald met')}</dt>
            <dd>{tx(payment.method)}</dd>
            <dt>{t('Date', 'Datum')}</dt>
            <dd>{date(payment.date)}</dd>
            <dt>{t('Reference', 'Kenmerk')}</dt>
            <dd className="num">{payment.id}</dd>
          </dl>
        </div>
      )}
    </Modal>
  );
}
