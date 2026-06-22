import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { conversations } from '../api/mockData';
import type { Channel, ConversationMock } from '../api/mockData';
import {
  Card,
  ConversationRow,
  MessageBubble,
  ReplyComposer,
  ScreenContent,
  ScreenTitle,
} from '../components/ui';
import { ChannelIcon } from '../components/icons';
import { SearchActionRow } from '../design-system';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { colors } from '../theme';

export function InboxScreen(props: {
  onOpenConversation: (conversationId: string) => void;
}): ReactElement {
  return (
    <ScreenContent>
      <ScreenTitle subtitle="Todas tus conversaciones en un solo lugar" title="Inbox" />

      <FeatureGate feature="inboxSearch">
        <SearchActionRow placeholder="Buscar conversaciones" showFilter />
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

      <Card flush>
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
        <Card flush>
          <FeatureGate feature="chatProfileHeader">
            <View style={styles.threadHeader}>
              <Text onPress={props.onBack} style={styles.backText}>‹</Text>
              <View style={styles.threadAvatar}>
                <Text style={styles.threadAvatarText}>{props.conversation.avatar}</Text>
              </View>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.threadName}>{props.conversation.customerName}</Text>
                <View style={styles.threadTags}>
                  <ChannelSourceTag channel={props.conversation.channel} />
                  {props.conversation.statusLabel ? (
                    <Text style={styles.leadBadge}>{props.conversation.statusLabel}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </FeatureGate>
          <FeatureGate feature="chatMessages">
            <View style={styles.chatArea}>
              {messages.map((message) => (
                <MessageBubble
                  direction={message.direction}
                  key={message.id}
                  source={message.source === 'copi' ? 'copi' : undefined}
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

function ChannelSourceTag(props: { channel: Channel }): ReactElement {
  const label =
    props.channel === 'whatsapp'
      ? 'WhatsApp'
      : props.channel === 'instagram'
        ? 'Instagram'
        : props.channel === 'facebook'
          ? 'Facebook'
          : 'Email';

  return (
    <View style={styles.channelTag}>
      <ChannelIcon channel={props.channel} size={12} />
      <Text style={styles.channelTagText}>{label}</Text>
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
  channelTag: {
    alignItems: 'center',
    backgroundColor: '#eef5ff',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  channelTagText: {
    color: '#1877f2',
    fontSize: 9,
    fontWeight: '600',
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
