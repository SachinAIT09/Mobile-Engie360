import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { SessionProvider, useSession } from '../providers/SessionProvider';
import { Banner } from '../components/Banner';
import { Loading, OfflinePill } from '../components/ui';
import { colors } from '../lib/theme';
import { I18nProvider } from '../lib/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Shows "Reconnecting…" / "Offline" under the banner while signed in and the live connection is down. */
function ConnectionPill() {
  const { token } = useAuth();
  const { status, banner } = useSession();
  const insets = useSafeAreaInsets();
  if (!token || status === 'connected') return null;
  // Sits where the Banner sits; drops below it while a banner is showing (banner is ~84px tall).
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 8 + (banner ? 84 : 0), zIndex: 90, alignItems: 'center' }}>
      <OfflinePill status={status} />
    </View>
  );
}

/** Routes reachable without signing in. */
const PUBLIC_ROUTES = new Set(['login']);

function AuthGate() {
  const { ready, token } = useAuth();
  const segments = useSegments() as string[];
  const first = segments[0] ?? '';

  useEffect(() => {
    if (!ready) return;
    const isPublic = PUBLIC_ROUTES.has(first);
    if (!token && !isPublic) router.replace('/login' as never);
    else if (token && first === 'login') router.replace('/' as never);
  }, [ready, token, first]);

  if (!ready) return <Loading dark />;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen
          name="ev-detected"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen
          name="assistant"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen name="smart-charging" />
      </Stack>
      <Banner />
      <ConnectionPill />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
    IBMPlexMono_500Medium,
  });

  const isWeb = Platform.OS === 'web';
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {/* On Expo Web, centre a phone-width column so the demo looks like a phone. */}
      <View style={{ flex: 1, backgroundColor: isWeb ? '#0B2240' : colors.bg, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: isWeb ? 480 : undefined, backgroundColor: colors.bg, overflow: 'hidden' }}>
          {fontsLoaded ? (
            <I18nProvider>
              <AuthProvider>
                <SessionProvider>
                  <AuthGate />
                </SessionProvider>
              </AuthProvider>
            </I18nProvider>
          ) : (
            <Loading dark />
          )}
        </View>
      </View>
    </SafeAreaProvider>
  );
}
