import type { ReactElement } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/icons';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import type { OwnerDashboard } from '../types/dashboard';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';
import { colors, shadows } from '../theme';

function roleLabel(role: OwnerDashboard['organization'] extends infer T
  ? T extends { role: infer R }
    ? R
    : null
  : null): string {
  if (role === 'owner') {
    return 'Dueño';
  }

  if (role === 'manager' || role === 'co_owner') {
    return 'Administrador';
  }

  return 'Equipo';
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'NX';
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function AccountScreen(props: {
  avatarUrl: string | null;
  businessName: string | null;
  fullName: string;
  onOpenBusinessSettings?: () => void;
  onOpenEditProfile: () => void;
  onOpenHelpSupport: () => void;
  onOpenPrivacyData: () => void;
  onOpenStaffInvite: () => void;
  onOpenWhatsAppSetup: () => void;
  onSignOut: () => void;
  onUploadAvatar: () => Promise<void>;
  role: OwnerDashboard['organization'] extends infer T
    ? T extends { role: infer R }
      ? R
      : null
    : null;
  timezoneLabel: string;
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
  const displayName = props.fullName.trim() || 'Tu nombre';
  const initials = initialsFromName(displayName);
  const canManageBusiness = props.role === 'owner';

  async function handleUploadAvatar(): Promise<void> {
    try {
      await props.onUploadAvatar();
    } catch (error) {
      if (error instanceof Error && error.message === 'CANCELLED') {
        return;
      }

      Alert.alert(
        'No se pudo actualizar la foto',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  return (
    <ScreenContent title="Mi cuenta">
      <ScreenTitle title="Mi cuenta" />

      <FeatureGate feature="accountProfile">
        <View style={styles.profileCard}>
          <Pressable onPress={() => void handleUploadAvatar()} style={styles.avatarPressable}>
            {props.avatarUrl ? (
              <Image source={{ uri: props.avatarUrl }} style={styles.profileAvatarImage} />
            ) : (
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.pencilBadge}>
              <Icon kind="edit" size={12} strokeWidth={2} />
            </View>
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileLine}>{props.businessName ?? 'Tu negocio'}</Text>
            <Text style={styles.profileLine}>{roleLabel(props.role)}</Text>
          </View>
        </View>
      </FeatureGate>

      <FeatureGate feature="accountSettings">
        <Card flush>
          <ActionRow icon="users" onPress={props.onOpenStaffInvite} showDivider title="Invitar miembro (QR)" />
          <ActionRow icon="user" onPress={props.onOpenEditProfile} showDivider title="Editar perfil" />
          <ActionRow
            icon="shield"
            onPress={props.onOpenPrivacyData}
            showDivider={Boolean(canManageBusiness && props.onOpenBusinessSettings)}
            title="Privacidad y datos"
          />
          {canManageBusiness && props.onOpenBusinessSettings ? (
            <ActionRow
              icon="gear"
              onPress={props.onOpenBusinessSettings}
              showDivider={false}
              title="Configuracion del negocio"
            />
          ) : null}
        </Card>
      </FeatureGate>

      <FeatureGate feature="accountConnectedServices">
        <Card flush>
          <ActionRow
            icon="whatsapp"
            onPress={props.onOpenWhatsAppSetup}
            showDivider
            subtitle={connectionCopy.subtitle}
            title={connectionCopy.title}
          />
          <ActionRow
            icon="globe"
            onPress={canManageBusiness ? props.onOpenBusinessSettings : undefined}
            showDivider={false}
            subtitle={canManageBusiness ? 'Tocá para editar' : undefined}
            title={`Zona horaria: ${props.timezoneLabel}`}
          />
        </Card>
      </FeatureGate>

      <Card flush>
        <ActionRow icon="help" onPress={props.onOpenHelpSupport} showDivider={false} title="Ayuda y soporte" />
      </Card>

      <ActionRow danger icon="logout" onPress={props.onSignOut} showDivider={false} title="Cerrar sesion" />
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  avatarPressable: {
    position: 'relative',
  },
  flex: {
    flex: 1,
  },
  pencilBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 26,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: '#dfaa8b',
    borderRadius: 999,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  profileAvatarImage: {
    borderRadius: 999,
    height: 72,
    width: 72,
  },
  profileCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    minHeight: 104,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileInitials: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '600',
  },
  profileLine: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  profileName: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
});
