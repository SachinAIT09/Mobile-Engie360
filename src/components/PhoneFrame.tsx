import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { brand } from '../brand';

/** The customer app as a phone-width column on a dark page (laptop view). See `lib/frame.ts`. */
export function PhoneFrame() {
  const { t } = useI18n();
  // The screen asked for in the address bar; later navigation happens inside the column.
  const [src] = useState(() => `${window.location.pathname}${window.location.search}${window.location.hash}`);

  return (
    <div className="phone-frame">
      <iframe
        src={src}
        title={t(`${brand.portal} app`, `${brand.portal}-app`)}
        // Keyboard goes straight to the app (Escape closes the chat, typing works) without a click first.
        onLoad={(e) => e.currentTarget.contentWindow?.focus()}
      />
    </div>
  );
}
