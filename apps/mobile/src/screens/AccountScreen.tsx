import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ownerProfile } from '../api/mockData';
import type { IconKind } from '../components/icons';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { colors, shadows } from '../theme';

export function AccountScreen(props: { onSignOut: () => void }): ReactElement {
  return (
    <ScreenContent>
      <ScreenTitle subtitle="Gestiona tu perfil y tu negocio" title="Mi cuenta" />

      <FeatureGate feature="accountProfile">
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>JF</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.profileName}>{ownerProfile.name}</Text>
            <Text style={styles.profileLine}>{ownerProfile.businessName} · Negocio</Text>
            <Text style={styles.profileLine}>{ownerProfile.activeBranch} · Sucursal</Text>
            <Text style={styles.profileLine}>{ownerProfile.role}</Text>
          </View>
        </View>
      </FeatureGate>

      <FeatureGate feature="accountSettings">
        <Card>
          {[
            ['user', 'Editar perfil'],
            ['store', 'Cambiar sucursal'],
            ['users', 'Usuarios y permisos'],
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
          <ActionRow icon="whatsapp" subtitle="Conectado" title="WhatsApp conectado" />
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
