import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  archiveOrganization,
  deleteAccount,
  deleteOrganization,
  exportOrganizationData,
  leaveOrganization,
  listOrganizationMembers,
  transferOwnership,
} from '../api/accountLifecycle';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, colors, spacing } from '../design-system';

/** Public store-facing deletion instructions (host or link from Play/App Store). */
export const ACCOUNT_DELETION_PUBLIC_URL =
  'https://github.com/souviksamanta-baas/Baas-Project/blob/main/docs/account-deletion.md';

export function PrivacyDataScreen(props: {
  onBack: () => void;
  onSignedOut: () => Promise<void>;
  organizationId: string | null;
  role: 'owner' | 'staff' | null;
}): ReactElement {
  const [confirmation, setConfirmation] = useState('');
  const [members, setMembers] = useState<Array<{ role: string; userId: string }>>([]);
  const [busy, setBusy] = useState(false);
  const isOwner = props.role === 'owner';

  useEffect(() => {
    if (!props.organizationId || !isOwner) {
      return;
    }
    void listOrganizationMembers(props.organizationId)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [isOwner, props.organizationId]);

  async function run(action: () => Promise<void>, successTitle: string): Promise<void> {
    setBusy(true);
    try {
      await action();
      Alert.alert(successTitle);
    } catch (error) {
      Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContent title="Privacidad y datos">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle="Exportá, salí del negocio o eliminá datos"
            title="Privacidad y datos"
          />
        </View>
      </View>

      <Card>
        <ActionRow
          icon="globe"
          onPress={() => {
            void Linking.openURL(ACCOUNT_DELETION_PUBLIC_URL);
          }}
          subtitle="Instrucciones públicas (Play / App Store)"
          title="Cómo eliminar tu cuenta"
        />
      </Card>

      {props.organizationId ? (
        <Card>
          {isOwner ? (
            <>
              <ActionRow
                icon="inbox"
                onPress={() => {
                  void run(async () => {
                    const payload = await exportOrganizationData(props.organizationId!);
                    await Share.share({
                      message: JSON.stringify(payload, null, 2).slice(0, 50_000),
                      title: 'Exportación Nexolia',
                    });
                  }, 'Exportación lista');
                }}
                subtitle="JSON con datos del negocio (GDPR)"
                title="Exportar datos del negocio"
              />
              <ActionRow
                danger
                icon="logout"
                onPress={() => {
                  void run(async () => {
                    await archiveOrganization({
                      confirmation: confirmation || 'ARCHIVAR',
                      organizationId: props.organizationId!,
                    });
                    await props.onSignedOut();
                  }, 'Negocio archivado');
                }}
                subtitle="Desactiva el negocio (confirmá ARCHIVAR abajo)"
                title="Archivar negocio"
              />
              <ActionRow
                danger
                icon="x"
                onPress={() => {
                  void run(async () => {
                    await deleteOrganization({
                      confirmation: confirmation || 'ELIMINAR',
                      organizationId: props.organizationId!,
                    });
                    await props.onSignedOut();
                  }, 'Negocio eliminado');
                }}
                subtitle="Borra el negocio y datos asociados (ELIMINAR)"
                title="Eliminar negocio"
              />
              {members
                .filter((member) => member.role !== 'owner')
                .map((member) => (
                  <ActionRow
                    icon="users"
                    key={member.userId}
                    onPress={() => {
                      void run(async () => {
                        await transferOwnership({
                          newOwnerUserId: member.userId,
                          organizationId: props.organizationId!,
                        });
                      }, 'Propiedad transferida');
                    }}
                    subtitle={member.userId}
                    title="Transferir propiedad a este miembro"
                  />
                ))}
            </>
          ) : (
            <ActionRow
              danger
              icon="logout"
              onPress={() => {
                void run(async () => {
                  await leaveOrganization(props.organizationId!);
                  await props.onSignedOut();
                }, 'Saliste del negocio');
              }}
              title="Salir del negocio"
            />
          )}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.hint}>
          Para archivar o eliminar, escribí la palabra de confirmación y tocá la acción.
        </Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setConfirmation}
          placeholder="ARCHIVAR o ELIMINAR"
          placeholderTextColor={colors.slate}
          style={styles.input}
          value={confirmation}
        />
        <PrimaryButton
          disabled={busy}
          label={busy ? 'Procesando…' : 'Eliminar mi cuenta'}
          onPress={() => {
            void run(async () => {
              await deleteAccount(confirmation || 'ELIMINAR');
              await props.onSignedOut();
            }, 'Cuenta eliminada');
          }}
        />
      </Card>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
    paddingRight: 4,
  },
  flex: { flex: 1 },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hint: {
    color: colors.slate,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.navy,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
