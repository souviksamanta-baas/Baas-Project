import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { SecondaryButton } from '../components/Buttons';
import { Metric } from '../components/Metric';
import { styles } from '../styles';
import type { OwnerDashboard } from '../types/dashboard';

export function DashboardScreen(props: {
  dashboard: OwnerDashboard;
  onSignOut: () => void;
}): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{props.dashboard.organization?.name ?? 'Owner dashboard'}</Text>
      <Text style={styles.bodyText}>Your Phase 0 dashboard is ready.</Text>
      <View style={styles.metricsGrid}>
        <Metric label="Contacts" value={props.dashboard.metrics.contacts} />
        <Metric label="Open chats" value={props.dashboard.metrics.openConversations} />
        <Metric label="Products" value={props.dashboard.metrics.products} />
        <Metric label="Low stock" value={props.dashboard.metrics.lowStockItems} />
      </View>
      {props.dashboard.emptyStates.map((emptyState: string) => (
        <Text key={emptyState} style={styles.emptyState}>
          {emptyState}
        </Text>
      ))}
      <SecondaryButton label="Sign out" onPress={props.onSignOut} />
    </View>
  );
}
