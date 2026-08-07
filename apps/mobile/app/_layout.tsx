import { Stack } from 'expo-router';
import { useEffect, type ReactElement } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OwnerSessionProvider } from '../src/context/OwnerSessionProvider';
import { ProfileChromeProvider } from '../src/context/ProfileChromeProvider';
import { ensureAndroidNotificationChannels } from '../src/lib/androidNotificationChannels';
import { colors } from '../src/theme';

export default function RootLayout(): ReactElement {
  useEffect(() => {
    void ensureAndroidNotificationChannels();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    // Light app chrome: dark status icons over the header background.
    StatusBar.setBarStyle('dark-content', true);
    StatusBar.setBackgroundColor(colors.background, true);
    StatusBar.setTranslucent(true);
  }, []);

  return (
    <SafeAreaProvider>
      {Platform.OS === 'android' ? (
        <StatusBar
          backgroundColor={colors.background}
          barStyle="dark-content"
          translucent
        />
      ) : (
        <StatusBar barStyle="dark-content" />
      )}
      <OwnerSessionProvider>
        <ProfileChromeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ProfileChromeProvider>
      </OwnerSessionProvider>
    </SafeAreaProvider>
  );
}
