import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { SecondaryButton } from '../components/Buttons';
import { Metric } from '../components/Metric';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { styles } from '../styles';
import type { OwnerDashboard } from '../types/dashboard';
import type { WhatsAppMessagePreview } from '../types/messages';

export function DashboardScreen(props: {
  dashboard: OwnerDashboard;
  onSignOut: () => void;
}): ReactElement {
  const recentMessages = useRealtimeMessages(props.dashboard.organization?.id ?? null);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{props.dashboard.organization?.name ?? 'Owner dashboard'}</Text>
      <Text style={styles.bodyText}>Your Phase 0 dashboard is ready.</Text>
      <WhatsAppConnectionCard dashboard={props.dashboard} />
      <RecentMessagesCard messages={recentMessages} />
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

function WhatsAppConnectionCard(props: { dashboard: OwnerDashboard }): ReactElement {
  const { whatsappConnection } = props.dashboard;
  const label = getWhatsAppStatusLabel(whatsappConnection.status);
  const detail =
    whatsappConnection.displayPhoneNumber ??
    whatsappConnection.phoneNumberId ??
    'Connect WhatsApp to start receiving customer messages.';

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>WhatsApp Business</Text>
      <Text style={styles.statusValue}>{label}</Text>
      <Text style={styles.statusDetail}>{detail}</Text>
      {whatsappConnection.lastError ? (
        <Text style={styles.statusError}>{whatsappConnection.lastError}</Text>
      ) : null}
    </View>
  );
}

function getWhatsAppStatusLabel(status: OwnerDashboard['whatsappConnection']['status']): string {
  if (status === 'connected') {
    return 'Connected';
  }

  if (status === 'pending') {
    return 'Pending verification';
  }

  if (status === 'error') {
    return 'Needs attention';
  }

  if (status === 'disabled') {
    return 'Disabled';
  }

  return 'Not connected';
}

function RecentMessagesCard(props: { messages: WhatsAppMessagePreview[] }): ReactElement {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>Live WhatsApp messages</Text>
      {props.messages.length === 0 ? (
        <Text style={styles.statusDetail}>New customer messages will appear here automatically.</Text>
      ) : (
        props.messages.slice(0, 3).map((message) => (
          <View key={message.id} style={styles.messagePreview}>
            <Text style={styles.messagePreviewMeta}>
              {message.direction === 'inbound' ? message.senderPhone : message.recipientPhone}
            </Text>
            <Text style={styles.messagePreviewBody}>{message.body ?? message.messageStatus}</Text>
          </View>
        ))
      )}
    </View>
  );
}
