import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ConversationRow, MetricGrid, NotificationRow, RobotAvatar, ScreenContent } from '../components/ui';
import type { AppTab } from '../components/ui';
import { Icon } from '../components/icons';
import { InfoBanner, ListBox, PrimaryButton, colors as dsColors, textStyles } from '../design-system';
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
import { buildWorkQueue, formatWorkQueueTime } from '../lib/workQueue';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';
import type { OwnerNotification, OwnerTask } from '../types/tasks';
import { colors, shadows } from '../theme';

export function HomeScreen(props: {
  conversations: InboxConversationSummary[];
  metrics: OwnerDashboard['metrics'] | null;
  notifications: OwnerNotification[];
  onOpenAlertProduct: (productId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenLowStock: () => void;
  onOpenManageStock: () => void;
  onOpenNotifications: () => void;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenTasks: () => void;
  onOpenWhatsAppSetup: () => void;
  onSelectTab: (tab: AppTab) => void;
  ownerGreeting: string;
  tasks: OwnerTask[];
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
  const connectionCopy = whatsappConnectionLabel(connection);
  const recentAlerts = buildWorkQueue(props.tasks, props.notifications).slice(0, 3);

  return (
    <ScreenContent collapseHeaderOnScroll={false}>
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
          <Text style={styles.summaryDescription}>¡Así va tu negocio hasta ahora. Sigue así! 💚</Text>
          <MetricGrid
            metrics={dashboardMetrics}
            onMetricPress={(metricId) => {
              if (metricId === 'messages') {
                props.onSelectTab('inbox');
                return;
              }

              if (metricId === 'tasks') {
                props.onOpenTasks();
                return;
              }

              if (metricId === 'stock') {
                props.onOpenLowStock();
              }
            }}
          />
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
          {props.conversations.slice(0, 4).map((conversation, index, rows) => (
            <ConversationRow
              avatar={conversationAvatarLabel(conversation)}
              channel={conversation.channel}
              key={conversation.id}
              name={conversationDisplayName(conversation)}
              onPress={() => props.onOpenConversation(conversation.id)}
              preview={conversationPreview(conversation)}
              showDivider={index < rows.length - 1}
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
            <Text style={styles.inventoryTitle}>Gestionar stock</Text>
            <Text style={styles.inventoryDescription}>Revisa tu inventario y actualiza productos</Text>
          </View>
          <Icon color="#c7c7cc" kind="chevron-right" size={20} strokeWidth={2.4} />
        </Pressable>
      </FeatureGate>

      <FeatureGate feature="homeAlerts">
        <ListBox
          headerAction={{ label: 'Ver todas las tareas', onPress: props.onOpenTasks }}
          title="Alertas recientes"
        >
          {recentAlerts.length === 0 ? (
            <Text style={styles.emptyBody}>No hay alertas activas.</Text>
          ) : null}
          {recentAlerts.map((alert, index) => (
            <NotificationRow
              key={alert.id}
              notification={{
                id: alert.id,
                subtitle: alert.subtitle,
                time: formatWorkQueueTime(alert.timestamp),
                title: alert.title,
                tone: alert.tone,
                unread: alert.isUnread,
              }}
              onPress={() => {
                if (alert.kind === 'task' && alert.taskId) {
                  props.onOpenTaskDetail(alert.taskId);
                  return;
                }

                if (alert.productId) {
                  props.onOpenAlertProduct(alert.productId);
                  return;
                }

                props.onOpenNotifications();
              }}
              showDivider={index < recentAlerts.length - 1}
            />
          ))}
        </ListBox>
      </FeatureGate>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  cardDescription: {
    ...textStyles.listBody,
    marginTop: 2,
  },
  cardTitle: {
    ...textStyles.listTitle,
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
    fontSize: 15,
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
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
    lineHeight: 41,
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
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inventoryDescription: {
    ...textStyles.listBody,
    marginTop: 2,
  },
  inventoryIcon: {
    alignItems: 'center',
    backgroundColor: dsColors.primarySoft,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  inventoryTitle: {
    ...textStyles.listTitle,
  },
  sectionTitle: {
    ...textStyles.sectionTitle,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  setupBlock: {
    gap: 12,
  },
  subtitle: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '400',
    marginTop: 4,
  },
  summaryCard: {
    gap: 4,
    paddingBottom: 8,
  },
  summaryDescription: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
    paddingHorizontal: 14,
  },
});
