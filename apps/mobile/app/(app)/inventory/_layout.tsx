import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export const unstable_settings = {
  initialRouteName: 'manage-stock',
};

export default function InventoryLayout(): ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
