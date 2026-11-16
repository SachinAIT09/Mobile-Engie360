import { MessageSquareText } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { Conversations, StaffHead } from '../parts';

export default function StaffConversations() {
  const { t } = useI18n();
  const { conversations } = useStaff();
  return (
    <>
      <StaffHead
        icon={MessageSquareText}
        title={t(`${brand.assistant.name} conversations`, `Gesprekken met ${brand.assistant.name}`)}
        sub={t(
          `Read along live with what the customer asks ${brand.assistant.name}. Unanswered questions and requests for an agent are marked.`,
          `Lees live mee met wat de klant aan ${brand.assistant.name} vraagt. Onbeantwoorde vragen en verzoeken om een medewerker zijn gemarkeerd.`,
        )}
      />
      <Conversations list={conversations} />
    </>
  );
}
