import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { listMyOrganizations, type MyOrganization } from '../api/dashboard';
import { acceptStaffInvite } from '../api/staffInvites';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { setPreferredOrganizationId } from '../lib/activeOrganization';
import { memberRoleLabel } from '../lib/orgRoles';
import { parseStaffInviteToken } from '../lib/staffInviteToken';
import { supabase } from '../lib/supabase';
import { normalizePhoneNumber } from '../services/phone';
import { colors } from '../theme';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

async function phoneFromCurrentUser(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  const rawPhone =
    typeof data.user.phone === 'string' && data.user.phone.trim()
      ? data.user.phone.trim()
      : null;
  if (!rawPhone) {
    return null;
  }

  return normalizePhoneNumber(rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`);
}

export function NegociosScreen(props: {
  businessName: string | null;
  onBack: () => void;
  onOpenCreateOrganization: () => void;
  onOrganizationSwitched?: () => Promise<void> | void;
  organizationId: string | null;
  role: string | null;
}): ReactElement {
  const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
  const [joinScannerOpen, setJoinScannerOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const loadOrganizations = useCallback(async (): Promise<void> => {
    try {
      const rows = await listMyOrganizations();
      setOrganizations(rows);
    } catch {
      setOrganizations([]);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations, props.organizationId]);

  useFocusEffect(
    useCallback(() => {
      void loadOrganizations();
    }, [loadOrganizations]),
  );

  async function handleSwitchOrganization(organizationId: string): Promise<void> {
    if (organizationId === props.organizationId) {
      return;
    }

    try {
      await setPreferredOrganizationId(organizationId);
      await props.onOrganizationSwitched?.();
      await loadOrganizations();
    } catch (error) {
      Alert.alert(
        'No se pudo cambiar de negocio',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  async function handleJoinInviteToken(rawToken: string): Promise<void> {
    const inviteToken = parseStaffInviteToken(rawToken);
    if (!inviteToken) {
      Alert.alert('QR inválido', 'Ese código no es una invitación de Nexolia.');
      return;
    }

    setIsJoining(true);
    try {
      const phone = await phoneFromCurrentUser();
      if (!phone) {
        Alert.alert(
          'Teléfono requerido',
          'Para unirte con QR necesitás una cuenta ingresada con teléfono. Pedile al dueño que invite ese mismo número.',
        );
        return;
      }

      const result = await acceptStaffInvite({
        inviteToken,
        verifiedPhoneE164: phone,
      });
      await setPreferredOrganizationId(result.organizationId);
      setJoinScannerOpen(false);
      await props.onOrganizationSwitched?.();
      await loadOrganizations();
      Alert.alert('Listo', 'Te uniste al negocio. Ya estás trabajando en él.');
    } catch (error) {
      Alert.alert(
        'No se pudo unir',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsJoining(false);
    }
  }

  const orgRows =
    organizations.length > 0
      ? organizations
      : props.organizationId && props.businessName
        ? [
            {
              createdAt: '',
              name: props.businessName,
              organizationId: props.organizationId,
              role: String(props.role ?? 'owner'),
            },
          ]
        : [];

  return (
    <ScreenContent title="Negocios">
      <ScreenTitle onBack={props.onBack} title="Negocios" />

      <Text style={styles.hint}>
        Cambiá de negocio, creá uno nuevo o uníte con el QR de una invitación.
      </Text>

      <Card flush>
        {orgRows.map((org) => {
          const selected = org.organizationId === props.organizationId;
          return (
            <ActionRow
              icon="store"
              key={org.organizationId}
              onPress={() => {
                void handleSwitchOrganization(org.organizationId);
              }}
              showDivider
              subtitle={selected ? 'Activo ahora' : memberRoleLabel(org.role)}
              title={org.name}
            />
          );
        })}
        <ActionRow
          icon="plus"
          onPress={props.onOpenCreateOrganization}
          showDivider
          subtitle="Vas a pasar a ser dueño del nuevo negocio"
          title="Crear otro negocio"
        />
        <ActionRow
          icon="qr"
          onPress={() => setJoinScannerOpen(true)}
          showDivider={false}
          subtitle={isJoining ? 'Uniéndote…' : 'Escaneá el QR que te compartió el dueño'}
          title="Unirme con invitación (QR)"
        />
      </Card>

      <Modal
        animationType="slide"
        onRequestClose={() => setJoinScannerOpen(false)}
        visible={joinScannerOpen}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.scanModal}>
          <BarcodeScannerScreen
            hint="Apuntá al QR de invitación que te compartió el dueño"
            onBack={() => setJoinScannerOpen(false)}
            onScanned={({ unlock, value }) => {
              void (async () => {
                try {
                  await handleJoinInviteToken(value);
                } finally {
                  unlock();
                }
              })();
            }}
            qrOnly
            title="Unirme a un negocio"
          />
        </SafeAreaView>
      </Modal>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  scanModal: {
    backgroundColor: colors.navy,
    flex: 1,
  },
});
