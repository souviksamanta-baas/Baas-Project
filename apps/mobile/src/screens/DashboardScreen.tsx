import type { ReactElement } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { SecondaryButton } from '../components/Buttons';
import { Metric } from '../components/Metric';
import { useInbox } from '../hooks/useInbox';
import { styles } from '../styles';
import type { OwnerDashboard } from '../types/dashboard';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';

export function DashboardScreen(props: {
  dashboard: OwnerDashboard;
  onSignOut: () => void;
}): ReactElement {
  const inbox = useInbox(props.dashboard.organization?.id ?? null);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{props.dashboard.organization?.name ?? 'Owner dashboard'}</Text>
      <Text style={styles.bodyText}>Your Phase 0 dashboard is ready.</Text>
      <WhatsAppConnectionCard dashboard={props.dashboard} />
      <InboxCard inbox={inbox} />
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

function InboxCard(props: { inbox: ReturnType<typeof useInbox> }): ReactElement {
  const { inbox } = props;

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>Universal inbox</Text>
      {inbox.isLoading ? <Text style={styles.statusDetail}>Loading conversations...</Text> : null}
      {inbox.errorMessage ? <Text style={styles.statusError}>{inbox.errorMessage}</Text> : null}
      {!inbox.isLoading && inbox.conversations.length === 0 ? (
        <Text style={styles.statusDetail}>Customer conversations will appear here automatically.</Text>
      ) : (
        <View style={styles.inboxLayout}>
          <View style={styles.conversationList}>
            {inbox.conversations.map((conversation) => (
              <ConversationListItem
                conversation={conversation}
                isSelected={conversation.id === inbox.selectedConversation?.id}
                key={conversation.id}
                onPress={() => inbox.selectConversation(conversation.id)}
              />
            ))}
          </View>
          {inbox.selectedConversation ? (
            <ConversationThread
              conversation={inbox.selectedConversation}
              messages={inbox.messages}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function ConversationListItem(props: {
  conversation: InboxConversationSummary;
  isSelected: boolean;
  onPress: () => void;
}): ReactElement {
  const { conversation } = props;
  const label = getContactLabel(conversation);
  const latestMessage = conversation.latestMessage?.body ?? 'No messages yet';

  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.conversationItem, props.isSelected && styles.selectedConversationItem]}
    >
      <Text style={styles.conversationTitle}>{label}</Text>
      <Text style={styles.conversationMeta}>
        {conversation.contact.leadStatus ?? 'new'} lead
        {conversation.lastMessageAt ? ` · ${formatTimestamp(conversation.lastMessageAt)}` : ''}
      </Text>
      <Text style={styles.messagePreviewBody}>{latestMessage}</Text>
    </Pressable>
  );
}

function ConversationThread(props: {
  conversation: InboxConversationSummary;
  messages: WhatsAppMessagePreview[];
}): ReactElement {
  return (
    <View style={styles.threadCard}>
      <Text style={styles.statusValue}>{getContactLabel(props.conversation)}</Text>
      <Text style={styles.statusDetail}>
        {props.conversation.contact.phoneNumber ?? props.conversation.externalContactId}
      </Text>
      <Text style={styles.conversationMeta}>
        Lead status: {props.conversation.contact.leadStatus ?? 'new'}
      </Text>
      {props.messages.length === 0 ? (
        <Text style={styles.statusDetail}>No persisted messages yet.</Text>
      ) : (
        props.messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.threadMessage,
              message.direction === 'outbound' && styles.outboundThreadMessage,
            ]}
          >
            <Text style={styles.messagePreviewMeta}>
              {message.direction === 'inbound' ? 'Customer' : 'Owner'} ·{' '}
              {formatTimestamp(message.createdAt)}
            </Text>
            <Text style={styles.messagePreviewBody}>{message.body ?? message.messageStatus}</Text>
          </View>
        ))
      )}
      <SecondaryButton label="Reply via approved send path" onPress={showReplyPathNotice} />
    </View>
  );
}

function getContactLabel(conversation: InboxConversationSummary): string {
  return (
    conversation.contact.displayName ??
    conversation.contact.phoneNumber ??
    conversation.externalContactId
  );
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showReplyPathNotice(): void {
  Alert.alert(
    'Server-side send required',
    'Outbound WhatsApp replies must route through the API send service so mobile never receives WhatsApp access tokens.',
  );
}
