import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  ConversationRow,
  MessageBubble,
  ReplyComposer,
  ScreenContent,
  ScreenTitle,
} from '../components/ui';
import { InfoBanner, PrimaryButton, SearchActionRow } from '../design-system';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import {
  conversationAvatarLabel,
  conversationDisplayName,
  conversationPreview,
  formatConversationTime,
  leadStatusLabel,
  messageBubbleText,
  messageBubbleTime,
  openConversationCount,
} from '../lib/inboxPresentation';
import type { OwnerDashboard } from '../types/dashboard';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';
import { whatsappConnectionLabel } from '../services/whatsapp';
import { colors } from '../theme';

export function InboxScreen(props: {
  conversations: InboxConversationSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  onOpenConversation: (conversationId: string) => void;
  onOpenWhatsAppSetup: () => void;
  whatsappConnection: OwnerDashboard['whatsappConnection'] | null;
}): ReactElement {
  const connection = props.whatsappConnection ?? {
    status: 'not_configured' as const,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedAt: null,
    lastStatusCheckAt: null,
    lastError: null,
  };
  const connectionCopy = whatsappConnectionLabel(connection);
  const openCount = openConversationCount(props.conversations);

  return (
    <ScreenContent>
      <ScreenTitle subtitle="Todas tus conversaciones en un solo lugar" title="Inbox" />

      {connection.status === 'connected' && connection.displayPhoneNumber ? (
        <InfoBanner>{`Respondiendo desde ${connection.displayPhoneNumber}`}</InfoBanner>
      ) : null}

      {connection.status !== 'connected' ? (
        <View style={styles.setupBlock}>
          <InfoBanner>{`${connectionCopy.title}\n${connectionCopy.subtitle}`}</InfoBanner>
          <PrimaryButton
            fullWidth
            label="Configurar WhatsApp"
            onPress={props.onOpenWhatsAppSetup}
          />
        </View>
      ) : null}

      <FeatureGate feature="inboxSearch">
        <SearchActionRow placeholder="Buscar conversaciones" showFilter />
      </FeatureGate>

      <Card flush>
        <FeatureGate feature="inboxTabs">
          <View style={styles.statusTabs}>
            <Text style={styles.activeStatusTab}>Abiertos {openCount}</Text>
            <Text style={styles.statusTab}>WhatsApp</Text>
          </View>
        </FeatureGate>

        {props.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!props.isLoading && props.errorMessage ? (
          <Text style={styles.errorText}>{props.errorMessage}</Text>
        ) : null}

        {!props.isLoading && props.conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Todavía no hay conversaciones</Text>
            <Text style={styles.emptyBody}>
              Cuando un cliente escriba por WhatsApp, la conversación va a aparecer acá en tiempo real.
            </Text>
          </View>
        ) : null}

        {props.conversations.map((conversation) => (
          <ConversationRow
            avatar={conversationAvatarLabel(conversation)}
            channel="whatsapp"
            key={conversation.id}
            name={conversationDisplayName(conversation)}
            onPress={() => props.onOpenConversation(conversation.id)}
            preview={conversationPreview(conversation)}
            statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
            time={formatConversationTime(conversation.lastMessageAt)}
          />
        ))}
      </Card>
    </ScreenContent>
  );
}

export function ConversationDetailScreen(props: {
  customerName: string;
  displayPhoneNumber?: string | null;
  isLoading: boolean;
  messages: WhatsAppMessagePreview[];
  onBack: () => void;
  statusLabel?: string;
  threadAvatar?: string;
}): ReactElement {
  return (
    <View style={styles.detailRoot}>
      <View style={styles.detailBody}>
        <Card flush>
          <FeatureGate feature="chatProfileHeader">
            <View style={styles.threadHeader}>
              <Pressable onPress={props.onBack}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
              <View style={styles.threadAvatar}>
                <Text style={styles.threadAvatarText}>{props.threadAvatar ?? 'WA'}</Text>
              </View>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.threadName}>{props.customerName}</Text>
                <View style={styles.threadTags}>
                  <View style={styles.channelBadgePill}>
                    <Text style={styles.channelTagText}>WhatsApp</Text>
                  </View>
                  {props.displayPhoneNumber ? (
                    <Text style={styles.businessNumberText}>{props.displayPhoneNumber}</Text>
                  ) : null}
                  {props.statusLabel ? <Text style={styles.leadBadge}>{props.statusLabel}</Text> : null}
                </View>
              </View>
            </View>
          </FeatureGate>
          <FeatureGate feature="chatMessages">
            <View style={styles.chatArea}>
              {props.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
              {!props.isLoading && props.messages.length === 0 ? (
                <Text style={styles.emptyBody}>Todavía no hay mensajes en este hilo.</Text>
              ) : null}
              {props.messages.map((message) => (
                <MessageBubble
                  direction={message.direction === 'outbound' ? 'outbound' : 'inbound'}
                  key={message.id}
                  text={messageBubbleText(message)}
                  time={messageBubbleTime(message)}
                />
              ))}
            </View>
          </FeatureGate>
        </Card>
      </View>
      <FeatureGate feature="chatComposer">
        <ReplyComposer placeholder="Escribi un mensaje..." />
      </FeatureGate>
    </View>
  );
}

const styles = StyleSheet.create({
  activeStatusTab: {
    borderBottomColor: colors.primary,
    borderBottomWidth: 2,
    color: colors.primary,
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    paddingBottom: 10,
    textAlign: 'center',
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    paddingHorizontal: 14,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  channelBadgePill: {
    backgroundColor: colors.badgeGreenBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  businessNumberText: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '500',
  },
  channelTagText: {
    color: '#1877f2',
    fontSize: 9,
    fontWeight: '600',
  },
  chatArea: {
    backgroundColor: '#fcfdfc',
    gap: 12,
    minHeight: 448,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  detailBody: {
    flex: 1,
    paddingHorizontal: 8,
  },
  detailRoot: {
    flex: 1,
    justifyContent: 'space-between',
  },
  emptyBody: {
    color: colors.slate,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyState: {
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  leadBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 9,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  setupBlock: {
    gap: 12,
    marginBottom: 12,
  },
  statusTab: {
    color: colors.slate,
    flex: 1,
    fontSize: 10,
    fontWeight: '300',
    paddingBottom: 10,
    textAlign: 'center',
  },
  statusTabs: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingTop: 12,
  },
  threadAvatar: {
    alignItems: 'center',
    backgroundColor: '#dfaa8b',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  threadAvatarText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '600',
  },
  threadHeader: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 86,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  threadName: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  threadTags: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
});
