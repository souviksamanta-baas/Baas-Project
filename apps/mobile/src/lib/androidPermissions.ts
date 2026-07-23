import { Alert, Linking, Platform } from 'react-native';

export type AndroidPermissionKind = 'camera' | 'photos' | 'microphone' | 'contacts' | 'notifications';

const PERMISSION_COPY: Record<
  AndroidPermissionKind,
  { title: string; body: string; settingsBody: string }
> = {
  camera: {
    title: 'Permiso de cámara',
    body: 'Nexolia necesita la cámara para escanear códigos y adjuntar fotos.',
    settingsBody:
      'Activá el permiso de cámara en Ajustes para seguir usando el escáner y las fotos.',
  },
  photos: {
    title: 'Permiso de fotos',
    body: 'Nexolia necesita acceso a tus fotos para adjuntar imágenes y actualizar el perfil.',
    settingsBody: 'Activá el acceso a fotos en Ajustes para continuar.',
  },
  microphone: {
    title: 'Permiso de micrófono',
    body: 'Nexolia usa el micrófono para que Copi transcriba tus preguntas de voz.',
    settingsBody: 'Activá el micrófono en Ajustes para usar la voz con Copi.',
  },
  contacts: {
    title: 'Permiso de contactos',
    body: 'Nexolia lee contactos solo para invitar al equipo o agregar clientes.',
    settingsBody: 'Activá Contactos en Ajustes para elegir personas más rápido.',
  },
  notifications: {
    title: 'Permiso de notificaciones',
    body: 'Nexolia te avisa sobre tareas, stock y pagos importantes.',
    settingsBody: 'Activá las notificaciones en Ajustes para no perder alertas del negocio.',
  },
};

export function showPermissionDeniedAlert(
  kind: AndroidPermissionKind,
  options?: { canAskAgain?: boolean },
): void {
  const copy = PERMISSION_COPY[kind];
  const canAskAgain = options?.canAskAgain !== false;

  if (!canAskAgain && Platform.OS === 'android') {
    Alert.alert(copy.title, copy.settingsBody, [
      { style: 'cancel', text: 'Ahora no' },
      {
        text: 'Abrir Ajustes',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]);
    return;
  }

  Alert.alert(copy.title, copy.body, [{ text: 'Entendido' }]);
}

export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}
