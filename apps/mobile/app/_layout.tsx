import { Stack } from 'expo-router';
import { useEffect, type ReactElement } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OwnerSessionProvider } from '../src/context/OwnerSessionProvider';
import { ProfileChromeProvider } from '../src/context/ProfileChromeProvider';
import { ensureAndroidNotificationChannels } from '../src/lib/androidNotificationChannels';

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
          <ProfileChromeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ProfileChromeProvider>
        </OwnerSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
