import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Spanish Android notification channels created before push token registration. */
export const ANDROID_NOTIFICATION_CHANNELS = [
  {
    id: 'tareas',
    name: 'Tareas',
    description: 'Recordatorios y tareas del negocio',
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: 'ventas',
    name: 'Ventas',
    description: 'Alertas de ventas y cobros',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: 'stock',
    name: 'Stock',
    description: 'Avisos de stock bajo y movimientos',
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: 'pagos',
    name: 'Pagos',
    description: 'Confirmaciones y problemas de pago',
    importance: Notifications.AndroidImportance.HIGH,
  },
] as const;

let channelsReady = false;

export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android' || channelsReady) {
    return;
  }

  await Promise.all(
    ANDROID_NOTIFICATION_CHANNELS.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: channel.importance,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#08bd66',
      }),
    ),
  );

  channelsReady = true;
}
