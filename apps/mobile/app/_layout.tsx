import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OwnerSessionProvider } from '../src/context/OwnerSessionProvider';

export default function RootLayout(): ReactElement {
  return (
    <SafeAreaProvider>
      <OwnerSessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OwnerSessionProvider>
    </SafeAreaProvider>
  );
}
