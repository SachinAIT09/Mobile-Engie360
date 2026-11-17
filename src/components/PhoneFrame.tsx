import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { brand } from '../brand';
import { giveUpPhoneFrame } from '../lib/frame';

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
        onLoad={(e) => {
          const app = e.currentTarget.contentWindow;
          try {
            // A blocked frame holds the browser's error page, which we are not allowed to read.
            void app?.location.href;
          } catch {
            giveUpPhoneFrame();
            return;
          }
          // Keyboard goes straight to the app (Escape closes the chat, typing works) without a click first.
          app?.focus();
        }}
      />
    </div>
  );
}
