import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AttentionFlag, CustomerDetail } from '../../../shared/contract';
import { API, get } from '../../api/client';
import { Card } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useI18n } from '../../lib/i18n';
import { useStaff } from '../context';
import { AudiencePicker, MessageHistory, MessageStats } from '../messaging';
import { Composer, StaffHead, type Audience } from '../parts';

/**
 * Messages to customers: how recent ones did, a three-step composer (who, what, when) and the
 * full history. A message goes to a group that shares an attention point or to one customer.
 */
export default function StaffMessages() {
  const { t, tx } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { overview, templates, connection, send, outbox, cancelScheduled, portfolio } = useStaff();
  // The dashboard, a customer page or an assistant draft opens this page with
  // ?segment=<attention point>, ?customer=<id> and/or ?template=<id>.
  const [params] = useSearchParams();
  const segmentId = params.get('segment');
  const customerId = params.get('customer');
  const [named, setNamed] = useState<{ id: string; name: string; live: boolean } | null>(null);
  const [picked, setPicked] = useState<Audience | undefined>(undefined);

  useEffect(() => {
    if (!customerId) return;
    let stale = false;
    get<CustomerDetail>(API.staffCustomer(customerId)).then(
      (d) => !stale && setNamed({ id: customerId, name: `${d.summary.firstName} ${d.summary.lastName}`, live: d.summary.live }),
      () => undefined,
    );
    return () => {
      stale = true;
    };
  }, [customerId]);

  const queue = portfolio?.queue ?? [];
  const queueItem = queue.find((q) => q.id === segmentId && q.templateId);
  const fromLink: Audience | undefined = queueItem
    ? { kind: 'segment', id: queueItem.id as AttentionFlag, label: tx(queueItem.title), count: queueItem.count, templateId: queueItem.templateId }
    : customerId && named?.id === customerId
      ? { kind: 'customer', id: customerId, name: named.name, live: named.live }
      : undefined;
  // What was chosen on this page wins; otherwise what the link asked for. A group's count follows the live queue.
  const chosen = picked ?? fromLink;
  const audience: Audience | undefined = chosen?.kind === 'segment' ? { ...chosen, count: queue.find((q) => q.id === chosen.id)?.count ?? chosen.count } : chosen;
  const wantedTemplate = params.get('template') ?? (picked?.kind === 'segment' ? picked.templateId : undefined);
  const initial = templates.find((tpl) => tpl.id === wantedTemplate) ?? null;

  const change = (a: Audience | undefined) => {
    setPicked(a);
    // Choosing someone else leaves the link's choice behind.
    if (segmentId || customerId) navigate('/staff/messages', { replace: true });
  };

  const cancel = (id: string) => {
    cancelScheduled(id).then(
      () => toast(t('Scheduled message cancelled', 'Ingepland bericht geannuleerd')),
      () => toast(t('Could not cancel the message', 'Het bericht kon niet worden geannuleerd')),
    );
  };

  return (
    <>
      <StaffHead
        icon={Send}
        title={t('Messages', 'Berichten')}
        sub={t('Message a group of customers who share an attention point, or one customer. See what was delivered, opened and acted on.', 'Stuur een bericht aan een groep klanten met hetzelfde aandachtspunt, of aan één klant. Zie wat is afgeleverd, geopend en opgevolgd.')}
      />
      <MessageStats items={outbox} />
      <Card title={t('New message', 'Nieuw bericht')} sub={t('Three steps: who, what, when. It lands in the app inbox, and on the phone if notifications are on.', 'Drie stappen: wie, wat, wanneer. Het komt in de inbox van de app, en op de telefoon als meldingen aan staan.')} className="new-message">
        <AudiencePicker key={`${audience?.kind ?? 'none'}`} queue={queue} audience={audience} onChange={change} />
        {/* Remount when the recipient or template changes, so the fields start filled in for them. */}
        <Composer key={`${initial?.id ?? 'blank'}-${audience?.kind ?? 'none'}-${audience?.id ?? ''}`} templates={templates} overview={overview} disabled={connection !== 'live'} onSend={send} initial={initial} audience={audience} />
      </Card>
      <MessageHistory items={outbox} onCancel={cancel} />
    </>
  );
}
