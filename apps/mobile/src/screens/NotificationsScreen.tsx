import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { notifications } from '../api/mockData';
import { Card, NotificationRow, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { colors } from '../theme';

export function NotificationsScreen(): ReactElement {
  return (
    <ScreenContent>
      <View style={styles.titleRow}>
        <ScreenTitle subtitle="Todo lo que necesita tu atencion" title="Notificaciones" />
        <Text style={styles.markRead}>Marcar todas como leidas</Text>
      </View>

      <FeatureGate feature="notificationsFilters">
        <View style={styles.filterRow}>
          {['Todas', 'No leidas', 'Stock', 'Seguimientos', 'Ventas'].map((filter, index) => (
            <View key={filter} style={[styles.filterPill, index === 0 && styles.activeFilterPill]}>
              <Text style={[styles.filterText, index === 0 && styles.activeFilterText]}>{filter}</Text>
            </View>
          ))}
        </View>
      </FeatureGate>

      <FeatureGate feature="notificationsList">
        <Card>
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </Card>
      </FeatureGate>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  activeFilterPill: {
    borderColor: colors.primary,
  },
  activeFilterText: {
    color: colors.primary,
  },
  filterPill: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  filterText: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
  },
  markRead: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    paddingBottom: 2,
  },
  titleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
