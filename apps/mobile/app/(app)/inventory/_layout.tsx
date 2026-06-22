import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function InventoryLayout(): ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
