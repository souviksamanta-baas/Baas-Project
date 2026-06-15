import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { conversations } from '../api/mockData';
import type { ConversationMock } from '../api/mockData';
import {
  Card,
  ConversationRow,
  MessageBubble,
  ReplyComposer,
  ScreenContent,
  ScreenTitle,
} from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { colors } from '../theme';

export function InboxScreen(props: {
  onOpenConversation: (conversationId: string) => void;
}): ReactElement {
  return (
    <ScreenContent>
      <ScreenTitle subtitle="Todas tus conversaciones en un solo lugar" title="Inbox" />

      <FeatureGate feature="inboxSearch">
        <View style={styles.searchRow}>
          <Text style={styles.searchText}>Buscar conversaciones</Text>
          <View style={styles.filterButton}>
            <Text style={styles.filterText}>≡</Text>
          </View>
        </View>
      </FeatureGate>

      <FeatureGate feature="inboxFilters">
        <View style={styles.channelRow}>
          {['Todos', 'WhatsApp', 'Instagram', 'Facebook', 'Email'].map((channel, index) => (
            <View key={channel} style={[styles.channelPill, index === 0 && styles.activeChannelPill]}>
              <Text style={[styles.channelText, index === 0 && styles.activeChannelText]}>{channel}</Text>
            </View>
          ))}
        </View>
      </FeatureGate>

      <Card>
        <FeatureGate feature="inboxTabs">
          <View style={styles.statusTabs}>
            <Text style={styles.activeStatusTab}>Abiertos 12</Text>
            <Text style={styles.statusTab}>Pendientes 5</Text>
            <Text style={styles.statusTab}>Resueltos 28</Text>
          </View>
        </FeatureGate>
        {conversations.map((conversation) => (
          <ConversationRow
            avatar={conversation.avatar}
            channel={conversation.channel}
            key={conversation.id}
            name={conversation.customerName}
            onPress={() => props.onOpenConversation(conversation.id)}
            preview={conversation.preview}
            statusLabel={conversation.statusLabel}
            time={conversation.time}
            unreadCount={conversation.unreadCount}
          />
        ))}
      </Card>
    </ScreenContent>
  );
}

export function ConversationDetailScreen(props: {
  conversation: ConversationMock;
  onBack: () => void;
}): ReactElement {
  const messages = props.conversation.messages.length > 0 ? props.conversation.messages : conversations[0].messages;

  return (
    <View style={styles.detailRoot}>
      <View style={styles.detailBody}>
        <Card>
          <FeatureGate feature="chatProfileHeader">
            <View style={styles.threadHeader}>
              <Text onPress={props.onBack} style={styles.backText}>‹</Text>
              <ConversationRow
                avatar={props.conversation.avatar}
                channel={props.conversation.channel}
                name={props.conversation.customerName}
                preview="Cliente potencial"
                statusLabel={props.conversation.statusLabel}
                time=""
              />
            </View>
          </FeatureGate>
          <FeatureGate feature="chatMessages">
            <View style={styles.chatArea}>
              {messages.map((message) => (
                <MessageBubble
                  direction={message.direction}
                  key={message.id}
                  source={message.source ?? (message.direction === 'inbound' ? props.conversation.channel : 'owner')}
                  text={message.text}
                  time={message.time}
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
  activeChannelPill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  activeChannelText: {
    color: colors.surface,
  },
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
  channelPill: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  channelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  channelText: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '300',
  },
  chatArea: {
    backgroundColor: '#fcfdfc',
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
  filterButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 38,
  },
  filterText: {
    color: colors.slate,
    fontSize: 18,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchText: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.slate,
    flex: 1,
    fontSize: 11,
    fontWeight: '300',
    height: 34,
    paddingHorizontal: 12,
    paddingTop: 9,
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
  threadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 86,
  },
});
