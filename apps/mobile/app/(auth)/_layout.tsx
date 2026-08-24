import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../../src/design-system';
import { useAndroidKeyboardHeight } from '../../src/hooks/useAndroidKeyboard';

export default function AuthLayout(): ReactElement {
  const androidKeyboardHeight = useAndroidKeyboardHeight();

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          Platform.OS === 'android' && androidKeyboardHeight > 0
            ? { paddingBottom: androidKeyboardHeight + spacing.md }
            : null,
        ]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
      >
        <Stack screenOptions={{ headerShown: false }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
