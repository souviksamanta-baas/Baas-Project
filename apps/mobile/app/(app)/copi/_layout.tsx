import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

import { OwnerCopilotProvider } from '../../../src/context/OwnerCopilotProvider';

export default function CopiLayout(): ReactElement {
  return (
    <OwnerCopilotProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OwnerCopilotProvider>
  );
}
