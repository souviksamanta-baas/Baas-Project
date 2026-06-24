import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { hasSupabaseConfig } from '../../src/lib/supabase';
import { styles } from '../../src/styles';

export default function AuthLayout(): ReactElement {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {hasSupabaseConfig ? null : (
          <>
            <Text style={styles.eyebrow}>BaaS Phase 0</Text>
            <Text style={styles.title}>Owner Assistant</Text>
          </>
        )}
        <Stack screenOptions={{ headerShown: false }} />
      </ScrollView>
    </SafeAreaView>
  );
}
