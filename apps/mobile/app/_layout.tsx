import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState, type ReactElement } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OwnerSessionProvider, useOwnerSessionContext } from '../src/context/OwnerSessionProvider';
import { ProfileChromeProvider } from '../src/context/ProfileChromeProvider';
import { ensureAndroidNotificationChannels } from '../src/lib/androidNotificationChannels';
import { approveBrowserSession, challengeIdFromUrl } from '../src/lib/approveBrowserSession';

function BrowserSessionLinkHandler(): null {
  const { authPhase, dashboard } = useOwnerSessionContext();
  const [challengeId, setChallengeId] = useState<string | null>(null);

  useEffect(() => {
    function remember(url: string | null) {
      const id = challengeIdFromUrl(url);
      if (id) setChallengeId(id);
    }

    void Linking.getInitialURL().then(remember);
    const subscription = Linking.addEventListener('url', (event) => {
      remember(event.url);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (authPhase !== 'authenticated' || !challengeId) return;
    void approveBrowserSession(challengeId, dashboard?.organization?.id, dashboard?.organization?.name);
  }, [authPhase, challengeId, dashboard?.organization?.id, dashboard?.organization?.name]);

  return null;
}

export default function RootLayout(): ReactElement {
  useEffect(() => {
    void ensureAndroidNotificationChannels();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/*
          Android 15+ edge-to-edge: do not set status/navigation bar colors or
          translucent — those Window APIs are deprecated and flagged by Play.
          Icon style only; insets come from SafeAreaProvider.
        */}
        <StatusBar barStyle="dark-content" />
        <OwnerSessionProvider>
          <BrowserSessionLinkHandler />
          <ProfileChromeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ProfileChromeProvider>
        </OwnerSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
