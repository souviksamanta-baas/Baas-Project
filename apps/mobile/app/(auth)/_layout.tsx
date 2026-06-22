import { Redirect, Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { hasSupabaseConfig } from '../../src/lib/supabase';
import { routes } from '../../src/navigation/routes';
import { styles } from '../../src/styles';

export default function AuthLayout(): ReactElement {
  const { authPhase } = useOwnerSessionContext();

  if (hasSupabaseConfig && authPhase === 'authenticated') {
    return <Redirect href={routes.appHome} />;
  }

  if (hasSupabaseConfig && authPhase === 'onboarding') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>BaaS Phase 0</Text>
          <Text style={styles.title}>Owner Assistant</Text>
          <Stack screenOptions={{ headerShown: false }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (hasSupabaseConfig && authPhase === 'pending_verify') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>BaaS Phase 0</Text>
          <Text style={styles.title}>Owner Assistant</Text>
          <Stack screenOptions={{ headerShown: false }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>BaaS Phase 0</Text>
        <Text style={styles.title}>Owner Assistant</Text>
        <Stack screenOptions={{ headerShown: false }} />
      </ScrollView>
    </SafeAreaView>
  );
}
