import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { createOrganizationWithOwner, getOwnerDashboard } from './src/features/onboarding';
import { supabase } from './src/lib/supabase';
import type { OwnerDashboard } from './src/types/dashboard';

type Route = 'loading' | 'login' | 'verify' | 'onboarding' | 'dashboard';

export default function App(): ReactElement {
  const [route, setRoute] = useState<Route>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmitPhone = useMemo(() => phone.trim().startsWith('+'), [phone]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      void bootstrapRoute(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void bootstrapRoute(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function bootstrapRoute(nextSession: Session | null): Promise<void> {
    if (!nextSession) {
      setDashboard(null);
      setRoute('login');
      return;
    }

    const nextDashboard = await getOwnerDashboard();
    setDashboard(nextDashboard);
    setRoute(nextDashboard.shouldOnboard ? 'onboarding' : 'dashboard');
  }

  async function requestOtp(): Promise<void> {
    if (!canSubmitPhone) {
      Alert.alert('Use E.164 format', 'Enter a phone number like +15555550100.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Could not send code', error.message);
      return;
    }

    setRoute('verify');
  }

  async function verifyOtp(): Promise<void> {
    setIsSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: otpCode.trim(),
      type: 'sms',
    });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Could not verify code', error.message);
    }
  }

  async function createOrganization(): Promise<void> {
    if (!businessName.trim()) {
      Alert.alert('Business name required', 'Enter your business name to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrganizationWithOwner(businessName.trim());
      await bootstrapRoute(session);
    } catch (error) {
      Alert.alert('Could not create business', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>BaaS Phase 0</Text>
        <Text style={styles.title}>Owner Assistant</Text>

        {route === 'loading' && (
          <View style={styles.card}>
            <ActivityIndicator />
            <Text style={styles.bodyText}>Checking session...</Text>
          </View>
        )}

        {route === 'login' && (
          <View style={styles.card}>
            <Text style={styles.heading}>Log in with phone</Text>
            <Text style={styles.bodyText}>Use your business phone number to receive a one-time code.</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="+15555550100"
              style={styles.input}
              value={phone}
            />
            <PrimaryButton disabled={isSubmitting || !canSubmitPhone} label="Send code" onPress={requestOtp} />
          </View>
        )}

        {route === 'verify' && (
          <View style={styles.card}>
            <Text style={styles.heading}>Enter verification code</Text>
            <Text style={styles.bodyText}>We sent an OTP to {phone}.</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setOtpCode}
              placeholder="123456"
              style={styles.input}
              value={otpCode}
            />
            <PrimaryButton disabled={isSubmitting || otpCode.trim().length === 0} label="Verify" onPress={verifyOtp} />
          </View>
        )}

        {route === 'onboarding' && (
          <View style={styles.card}>
            <Text style={styles.heading}>Create your business</Text>
            <Text style={styles.bodyText}>This creates your organization and links you as the owner.</Text>
            <TextInput
              onChangeText={setBusinessName}
              placeholder="My Business"
              style={styles.input}
              value={businessName}
            />
            <PrimaryButton disabled={isSubmitting} label="Create business" onPress={createOrganization} />
          </View>
        )}

        {route === 'dashboard' && dashboard && (
          <View style={styles.card}>
            <Text style={styles.heading}>{dashboard.organization?.name ?? 'Owner dashboard'}</Text>
            <Text style={styles.bodyText}>Your Phase 0 dashboard is ready.</Text>
            <View style={styles.metricsGrid}>
              <Metric label="Contacts" value={dashboard.metrics.contacts} />
              <Metric label="Open chats" value={dashboard.metrics.openConversations} />
              <Metric label="Products" value={dashboard.metrics.products} />
              <Metric label="Low stock" value={dashboard.metrics.lowStockItems} />
            </View>
            {dashboard.emptyStates.map((emptyState: string) => (
              <Text key={emptyState} style={styles.emptyState}>
                {emptyState}
              </Text>
            ))}
            <SecondaryButton label="Sign out" onPress={signOut} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton(props: { disabled?: boolean; label: string; onPress: () => void }): ReactElement {
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.primaryButton, props.disabled && styles.disabledButton]}
    >
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function SecondaryButton(props: { label: string; onPress: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function Metric(props: { label: string; value: number }): ReactElement {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{props.value}</Text>
      <Text style={styles.metricLabel}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flexGrow: 1,
    padding: 24,
  },
  eyebrow: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 24,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    gap: 16,
    padding: 20,
  },
  heading: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  bodyText: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metric: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    minWidth: '47%',
    padding: 14,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    padding: 12,
  },
});
