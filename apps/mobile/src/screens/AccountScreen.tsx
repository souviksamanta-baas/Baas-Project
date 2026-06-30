import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { IconKind } from '../components/icons';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import type { OwnerDashboard } from '../types/dashboard';
import { whatsappConnectionLabel } from '../services/whatsapp';
import { colors, shadows } from '../theme';

export function AccountScreen(props: {
  businessCenterName: string | null;
  businessName: string | null;
  onOpenStaffInvite: () => void;
  onOpenWhatsAppSetup: () => void;
  onSignOut: () => void;
  role: OwnerDashboard['organization'] extends infer T
    ? T extends { role: infer R }
      ? R
      : null
    : null;
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
  const initials = (props.businessName ?? 'NX').slice(0, 2).toUpperCase();

  return (
    <ScreenContent>
      <ScreenTitle subtitle="Gestiona tu perfil y tu negocio" title="Mi cuenta" />

      <FeatureGate feature="accountProfile">
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>{initials}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.profileName}>{props.businessName ?? 'Tu negocio'}</Text>
            <Text style={styles.profileLine}>{props.businessCenterName ?? 'Sucursal principal'}</Text>
            <Text style={styles.profileLine}>{props.role === 'owner' ? 'Dueño' : 'Equipo'}</Text>
          </View>
        </View>
      </FeatureGate>

      <FeatureGate feature="accountSettings">
        <Card>
          <ActionRow icon="users" onPress={props.onOpenStaffInvite} title="Invitar miembro (QR)" />
          {[
            ['user', 'Editar perfil'],
            ['store', 'Cambiar sucursal'],
            ['gear', 'Configuracion del negocio'],
            ['bell', 'Notificaciones'],
            ['help', 'Ayuda y soporte'],
          ].map(([icon, title]) => (
            <ActionRow icon={icon as IconKind} key={title} title={title} />
          ))}
        </Card>
      </FeatureGate>

      <FeatureGate feature="accountConnectedServices">
        <Card>
          <ActionRow
            icon="whatsapp"
            onPress={props.onOpenWhatsAppSetup}
            subtitle={connectionCopy.subtitle}
            title={connectionCopy.title}
          />
          <ActionRow icon="globe" title="Zona horaria: Argentina / Cordoba" />
        </Card>
      </FeatureGate>

      <ActionRow danger icon="logout" onPress={props.onSignOut} title="Cerrar sesion" />
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: '#dfaa8b',
    borderRadius: 999,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  profileCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 18,
    minHeight: 128,
    paddingHorizontal: 18,
  },
  profileInitials: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '600',
  },
  profileLine: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 8,
  },
  profileName: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 21,
  },
});
