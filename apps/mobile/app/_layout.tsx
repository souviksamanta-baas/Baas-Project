import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OwnerSessionProvider } from '../src/context/OwnerSessionProvider';
import { ProfileChromeProvider } from '../src/context/ProfileChromeProvider';

export default function RootLayout(): ReactElement {
  return (
    <SafeAreaProvider>
      <OwnerSessionProvider>
        <ProfileChromeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ProfileChromeProvider>
      </OwnerSessionProvider>
    </SafeAreaProvider>
  );
}
