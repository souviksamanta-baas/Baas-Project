import { Stack } from 'expo-router';
import { useEffect, type ReactElement } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OwnerSessionProvider } from '../src/context/OwnerSessionProvider';
import { ProfileChromeProvider } from '../src/context/ProfileChromeProvider';
import { ensureAndroidNotificationChannels } from '../src/lib/androidNotificationChannels';

export default function RootLayout(): ReactElement {
  useEffect(() => {
    void ensureAndroidNotificationChannels();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={Platform.OS === 'android' ? 'light-content' : 'dark-content'}
        backgroundColor={Platform.OS === 'android' ? '#0f172a' : undefined}
        translucent={Platform.OS === 'android'}
      />
      <OwnerSessionProvider>
        <ProfileChromeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ProfileChromeProvider>
      </OwnerSessionProvider>
    </SafeAreaProvider>
  );
}
