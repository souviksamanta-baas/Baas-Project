import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconKind } from '../components/icons';
import { ActionRow, Card, ConversationRow, MetricGrid, NotificationRow, RobotAvatar, ScreenContent } from '../components/ui';
import type { AppTab } from '../components/ui';
import { Icon } from '../components/icons';
import { InfoBanner, ListBox, PrimaryButton, colors as dsColors } from '../design-system';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import {
  conversationAvatarLabel,
  conversationDisplayName,
  conversationPreview,
  formatConversationTime,
  leadStatusLabel,
} from '../lib/inboxPresentation';
import type { OwnerDashboard } from '../types/dashboard';
import type { InboxConversationSummary } from '../types/messages';
import { formatWeeklySales } from '../lib/formatCurrency';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';
import { notifications } from '../api/mockData';
import { colors, shadows } from '../theme';

export function HomeScreen(props: {
  conversations: InboxConversationSummary[];
  metrics: OwnerDashboard['metrics'] | null;
  onOpenConversation: (conversationId: string) => void;
  onOpenManageStock: () => void;
  onOpenNotifications: () => void;
  onOpenTasks: () => void;
  onOpenWhatsAppSetup: () => void;
  onSelectTab: (tab: AppTab) => void;
  ownerGreeting: string;
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
  const dashboardMetrics = [
    { id: 'messages', label: 'Mensajes hoy', tone: 'green' as const, value: String(props.metrics?.messagesToday ?? 0) },
    {
      id: 'tasks',
      label: 'Seguimientos pendientes',
      tone: 'orange' as const,
      value: String(props.metrics?.pendingFollowUps ?? 0),
    },
    {
      id: 'stock',
      label: 'Productos con bajo stock',
      tone: 'red' as const,
      value: String(props.metrics?.lowStockItems ?? 0),
    },
    {
      id: 'sales',
      label: 'Ventas (Semana)',
      tone: 'green' as const,
      value: formatWeeklySales(props.metrics?.weeklySalesCents ?? 0),
    },
  ];

  return (
    <ScreenContent>
      <View>
        <Text style={styles.greeting}>{props.ownerGreeting}</Text>
        <Text style={styles.subtitle}>En que puedo ayudarte hoy?</Text>
      </View>

      {connection.status !== 'connected' ? (
        <View style={styles.setupBlock}>
          <InfoBanner>{`${connectionCopy.title}\n${connectionCopy.subtitle}`}</InfoBanner>
          <PrimaryButton fullWidth label="Conectar WhatsApp" onPress={props.onOpenWhatsAppSetup} />
        </View>
      ) : null}

      <FeatureGate feature="homeAssistant">
        <Pressable onPress={() => props.onSelectTab('copi')} style={styles.copiCard}>
          <RobotAvatar />
          <View style={[styles.flex, styles.flexShrink]}>
            <Text style={styles.cardTitle}>Copi - Tu asistente IA</Text>
            <Text numberOfLines={2} style={styles.cardDescription}>
              Preguntame sobre tus ventas, stock, clientes y mas.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => props.onSelectTab('copi')}
            style={styles.chatButton}
          >
            <Icon color={colors.primary} kind="message" size={18} strokeWidth={1.8} />
          </Pressable>
        </Pressable>
      </FeatureGate>

      <FeatureGate feature="homeMetrics">
        <Card flush style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen del día</Text>
          <Text style={styles.cardDescription}>¡Así va tu negocio hasta ahora. Sigue así! 💚</Text>
          <MetricGrid metrics={dashboardMetrics} />
          {(props.metrics?.pendingFollowUps ?? 0) > 0 ? (
            <Pressable onPress={props.onOpenTasks} style={styles.tasksLink}>
              <Text style={styles.tasksLinkText}>Ver seguimientos pendientes</Text>
            </Pressable>
          ) : null}
        </Card>
      </FeatureGate>

      <FeatureGate feature="homeConversations">
        <ListBox
          headerAction={{ label: 'Ver todas', onPress: () => props.onSelectTab('inbox') }}
          title="Conversaciones recientes"
        >
          {props.conversations.length === 0 ? (
            <Text style={styles.emptyBody}>Todavía no hay conversaciones de WhatsApp.</Text>
          ) : null}
          {props.conversations.slice(0, 4).map((conversation) => (
            <ConversationRow
              avatar={conversationAvatarLabel(conversation)}
              channel={conversation.channel}
              key={conversation.id}
              name={conversationDisplayName(conversation)}
              onPress={() => props.onOpenConversation(conversation.id)}
              preview={conversationPreview(conversation)}
              statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
              time={formatConversationTime(conversation.lastMessageAt)}
            />
          ))}
        </ListBox>
      </FeatureGate>

      <FeatureGate feature="homeInventoryCta">
        <Pressable onPress={props.onOpenManageStock} style={styles.inventoryCard}>
          <View style={styles.inventoryIcon}>
            <Icon color={colors.primary} kind="box" size={18} strokeWidth={1.8} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Gestionar stock</Text>
            <Text style={styles.cardDescription}>Revisa tu inventario y actualiza productos</Text>
          </View>
          <Text style={styles.primaryText}>Ver inventario ›</Text>
        </Pressable>
      </FeatureGate>

      <FeatureGate feature="homeAlerts">
        <ListBox
          headerAction={{ label: 'Ver todas', onPress: props.onOpenNotifications }}
          title="Alertas recientes"
        >
          {notifications.slice(0, 3).map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </ListBox>
      </FeatureGate>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  cardDescription: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    lineHeight: 15,
    marginTop: 4,
  },
  cardTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: dsColors.primarySoft,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  copiCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    paddingHorizontal: 14,
  },
  emptyBody: {
    color: colors.slate,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    color: colors.navy,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  inventoryCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 14,
  },
  inventoryIcon: {
    alignItems: 'center',
    backgroundColor: dsColors.primarySoft,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  primaryText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  setupBlock: {
    gap: 12,
  },
  subtitle: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '300',
    marginTop: 4,
  },
  summaryCard: {
    gap: 8,
    paddingBottom: 12,
  },
  tasksLink: {
    paddingHorizontal: 14,
  },
  tasksLinkText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
});
