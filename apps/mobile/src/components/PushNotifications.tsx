import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../lib/theme';
import { disablePush, enablePush, pushState, type PushState } from '../lib/webPush';
import { Button, Card, IconTile, InfoNote, Txt } from './ui';

const DISMISS_KEY = 'h1demo.pushPromptDismissed';

const STATUS: Record<PushState, string> = {
  unsupported: 'Not available in this browser',
  'needs-install': 'Add the app to your Home Screen first',
  off: 'Off on this phone',
  on: 'On for this phone',
  blocked: 'Blocked in browser settings',
};

function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    let live = true;
    void pushState()
      .then((s) => live && setState(s))
      .catch(() => live && setState('unsupported'));
    return () => {
      live = false;
    };
  }, []);
  return [state, setState] as const;
}

function InstallHint() {
  return (
    <InfoNote icon="info">
      On iPhone: tap Share, then “Add to Home Screen”. Open the app from the new icon, sign in, and turn notifications on there.
    </InfoNote>
  );
}

/** Settings row: phone notifications (web push) on or off for this phone. */
export function PhonePushRow() {
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const toggle = useCallback(() => {
    setBusy(true);
    const next = state === 'on' ? disablePush().then(() => pushState()) : enablePush();
    void next
      .then(setState)
      .catch(() => setState('blocked'))
      .finally(() => setBusy(false));
  }, [state, setState]);

  if (!state || state === 'unsupported') return null;
  return (
    <View style={{ gap: 10, paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={15} weight="medium">
            Phone notifications
          </Txt>
          <Txt size={12} color={state === 'on' ? colors.successText : colors.textMuted}>
            {STATUS[state]}
          </Txt>
        </View>
        {state === 'on' || state === 'off' ? (
          <Button label={state === 'on' ? 'Turn off' : 'Turn on'} variant={state === 'on' ? 'secondary' : 'primary'} height={44} onPress={toggle} loading={busy} accessibilityLabel={state === 'on' ? 'Turn off phone notifications' : 'Turn on phone notifications'} />
        ) : null}
      </View>
      {state === 'needs-install' ? <InstallHint /> : null}
      {state === 'blocked' ? <InfoNote icon="info">Notifications are blocked for this site. Allow them in the browser’s site settings, then come back here.</InfoNote> : null}
    </View>
  );
}

/** One-time Home prompt to turn on phone notifications (permission must come from a tap). */
export function PushPrompt() {
  const [state, setState] = usePushState();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then((v) => setDismissed(v === '1'))
      .catch(() => setDismissed(false));
  }, []);

  if (dismissed !== false || (state !== 'off' && state !== 'needs-install')) return null;
  const dismiss = () => {
    setDismissed(true);
    void AsyncStorage.setItem(DISMISS_KEY, '1').catch(() => undefined);
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <IconTile name="bell" size={44} bg={colors.accentTint} color={colors.accentDark} round />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={15} weight="semibold" color={colors.navy}>
            Get grid alerts on this phone
          </Txt>
          <Txt size={13} color={colors.textMuted}>
            Stop-charging requests, offers and bills, even when the app is closed.
          </Txt>
        </View>
      </View>
      {state === 'needs-install' ? (
        <View style={{ marginTop: 12 }}>
          <InstallHint />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        {state === 'off' ? (
          <Button
            label="Turn on"
            height={44}
            style={{ flex: 1 }}
            loading={busy}
            accessibilityLabel="Turn on phone notifications"
            onPress={() => {
              setBusy(true);
              void enablePush()
                .then(setState)
                .catch(() => setState('blocked'))
                .finally(() => setBusy(false));
            }}
          />
        ) : null}
        <Button label="Not now" variant="secondary" height={44} style={{ flex: 1 }} onPress={dismiss} />
      </View>
    </Card>
  );
}
