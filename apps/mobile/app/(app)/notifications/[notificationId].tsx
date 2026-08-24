import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { confirmCopiAction } from '../../../src/api/ai';
import { ScreenContent } from '../../../src/components/ui';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerTasks } from '../../../src/hooks/useOwnerTasks';
import {
  productDetailRoute,
  routes,
  taskDetailRoute,
} from '../../../src/navigation/routes';
import { NotificationDetailScreen } from '../../../src/screens/NotificationDetailScreen';
import { colors } from '../../../src/theme';

export default function NotificationDetailRoute(): ReactElement {
  const router = useRouter();
  const { notificationId: rawId } = useLocalSearchParams<{ notificationId: string }>();
  const notificationId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const tasksState = useOwnerTasks(organizationId, businessCenterId);

  const notification = useMemo(
    () =>
      notificationId
        ? (tasksState.notifications.find((item) => item.id === notificationId) ?? null)
        : null,
    [notificationId, tasksState.notifications],
  );

  const goBack = (): void => {
    router.replace(routes.notifications);
  };

  if (!notificationId || !notification) {
    return (
      <ScreenContent>
        <Text style={styles.message}>No se encontró la alerta.</Text>
        <Pressable onPress={goBack}>
          <Text style={styles.link}>Volver</Text>
        </Pressable>
      </ScreenContent>
    );
  }

  return (
    <NotificationDetailScreen
      isSaving={tasksState.isSaving}
      notification={notification}
      onBack={goBack}
      onConfirmCopiAction={async (actionId) => {
        if (!organizationId || !businessCenterId) {
          return;
        }
        try {
          await confirmCopiAction({
            actionId,
            businessCenterId,
            organizationId,
          });
          await tasksState.dismissNotification(notification.id);
          await tasksState.refresh();
          Alert.alert('Listo', 'La acción de Copi quedó confirmada.');
          goBack();
        } catch (error) {
          Alert.alert(
            'No se pudo confirmar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
          throw error;
        }
      }}
      onDismiss={async () => {
        await tasksState.dismissNotification(notification.id);
        goBack();
      }}
      onOpenProduct={(productId) =>
        router.push(productDetailRoute(productId, 'notifications'))
      }
      onOpenTask={(taskId) => router.push(taskDetailRoute(taskId, 'notifications'))}
    />
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  message: {
    color: colors.slate,
    fontSize: 15,
  },
});
