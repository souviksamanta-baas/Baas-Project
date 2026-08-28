import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  appointmentDetailRoute,
  conversationRoute,
  invoiceDetailRoute,
  notificationDetailRoute,
  productDetailRoute,
  routes,
  taskDetailRoute,
} from '../navigation/routes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolvePushRoute(data: Record<string, unknown> | undefined): string | null {
  if (!data) {
    return null;
  }

  const type = typeof data.type === 'string' ? data.type : null;
  const notificationId =
    typeof data.notificationId === 'string'
      ? data.notificationId
      : typeof data.notification_id === 'string'
        ? data.notification_id
        : null;
  const taskId = typeof data.taskId === 'string' ? data.taskId : null;
  const productId = typeof data.productId === 'string' ? data.productId : null;
  const conversationId =
    typeof data.conversationId === 'string' ? data.conversationId : null;
  const appointmentId =
    typeof data.appointmentId === 'string' ? data.appointmentId : null;
  const invoiceId = typeof data.invoiceId === 'string' ? data.invoiceId : null;

  if (taskId && type?.startsWith('task.')) {
    return taskDetailRoute(taskId, 'notifications');
  }
  if (productId && (type === 'stock.low' || type === 'stock.movement')) {
    return productDetailRoute(productId, 'notifications');
  }
  if (conversationId && type?.startsWith('inbox.')) {
    return conversationRoute(conversationId);
  }
  if (appointmentId && type?.startsWith('appointment.')) {
    return appointmentDetailRoute(appointmentId);
  }
  if (invoiceId && (type === 'invoice.overdue' || type === 'payment.failed')) {
    return invoiceDetailRoute(invoiceId);
  }
  if (notificationId) {
    return notificationDetailRoute(notificationId);
  }
  if (taskId) {
    return taskDetailRoute(taskId, 'notifications');
  }
  if (productId) {
    return productDetailRoute(productId, 'notifications');
  }

  return routes.notifications;
}

/**
 * Opens the right screen when the user taps an OS push (foreground, background, cold start).
 */
export function usePushNotificationRouting(enabled: boolean): void {
  const router = useRouter();
  const handledResponseIds = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function openFromResponse(response: Notifications.NotificationResponse | null): void {
      if (!response) {
        return;
      }
      const responseId = response.notification.request.identifier;
      if (handledResponseIds.current.has(responseId)) {
        return;
      }
      handledResponseIds.current.add(responseId);

      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = resolvePushRoute(data);
      if (route) {
        router.push(route as never);
      }
    }

    void Notifications.getLastNotificationResponseAsync().then(openFromResponse);

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => {
      subscription.remove();
    };
  }, [enabled, router]);
}
