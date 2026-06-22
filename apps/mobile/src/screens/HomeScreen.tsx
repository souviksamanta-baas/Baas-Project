import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { conversations, dashboardMetrics, notifications } from '../api/mockData';
import {
  Card,
  ConversationRow,
  MetricGrid,
  NotificationRow,
  RobotAvatar,
  ScreenContent,
} from '../components/ui';
import type { AppTab } from '../components/ui';
import { Icon } from '../components/icons';
import { ListBox, colors as dsColors } from '../design-system';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { colors, shadows } from '../theme';

export function HomeScreen(props: {
  onOpenConversation: (conversationId: string) => void;
  onOpenManageStock: () => void;
  onOpenNotifications: () => void;
  onSelectTab: (tab: AppTab) => void;
}): ReactElement {
  return (
    <ScreenContent>
      <View>
        <Text style={styles.greeting}>Hola Juli!</Text>
        <Text style={styles.subtitle}>En que puedo ayudarte hoy?</Text>
      </View>

      <FeatureGate feature="homeAssistant">
        <Pressable onPress={() => props.onSelectTab('copi')} style={styles.copiCard}>
          <RobotAvatar />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Copi - Tu asistente IA</Text>
            <Text style={styles.cardDescription}>Preguntame sobre tus ventas, stock, clientes y mas.</Text>
          </View>
          <View style={styles.chatButton}>
            <Icon color={colors.primary} kind="message" size={18} strokeWidth={1.8} />
          </View>
        </Pressable>
      </FeatureGate>

      <FeatureGate feature="homeMetrics">
        <Card flush style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen del dia</Text>
          <Text style={styles.cardDescription}>Asi va tu negocio hasta ahora. Sigue asi!</Text>
          <MetricGrid metrics={dashboardMetrics} />
        </Card>
      </FeatureGate>

      <FeatureGate feature="homeConversations">
        <ListBox
          headerAction={{ label: 'Ver todas', onPress: () => props.onSelectTab('inbox') }}
          title="Conversaciones recientes"
        >
          {conversations.slice(0, 4).map((conversation) => (
            <ConversationRow
              avatar={conversation.avatar}
              channel={conversation.channel}
              key={conversation.id}
              name={conversation.customerName}
              onPress={() => props.onOpenConversation(conversation.id)}
              preview={conversation.preview}
              statusLabel={conversation.statusLabel}
              time={conversation.time}
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
    fontSize: 10.5,
    fontWeight: '300',
    lineHeight: 14,
    marginTop: 4,
  },
  cardTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  copiCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: dsColors.surfaceMint,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    height: 90,
    paddingHorizontal: 12,
  },
  flex: {
    flex: 1,
  },
  greeting: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  inventoryCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: dsColors.surfaceMint,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 70,
    paddingHorizontal: 15,
  },
  inventoryIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  primaryText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  subtitle: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '300',
    marginTop: 5,
  },
  summaryCard: {
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
});
