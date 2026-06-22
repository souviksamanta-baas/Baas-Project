import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function CopiLayout(): ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
