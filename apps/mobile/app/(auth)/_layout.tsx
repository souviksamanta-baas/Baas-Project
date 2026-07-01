import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';

import { colors } from '../../src/design-system';

export default function AuthLayout(): ReactElement {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Stack screenOptions={{ headerShown: false }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
});
