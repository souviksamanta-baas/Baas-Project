import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  confirmIdentityMerge,
  getMyIdentities,
  requestEmailIdentityLink,
  requestWhatsAppIdentityLink,
  verifyEmailIdentityLink,
  verifyWhatsAppIdentityLink,
  type IdentityMe,
  type MergeOrgPreview,
} from '../api/identities';
import { listMyOrganizations } from '../api/dashboard';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { useProfileChromeOptional } from '../context/ProfileChromeProvider';
import { PrimaryButton, TextField } from '../design-system';
import { useAndroidUnsavedBack } from '../hooks/useAndroidUnsavedBack';
import { supabase } from '../lib/supabase';
import {
  getOtpCodeLength,
  isOtpCodeComplete,
  normalizeOtpInput,
} from '../services/authOtp';
import { colors } from '../theme';

type LinkKind = 'email' | 'phone';

type LinkFlowState =
  | { kind: LinkKind; phase: 'idle' }
  | { kind: LinkKind; phase: 'enter'; value: string }
  | { kind: LinkKind; phase: 'otp'; value: string; code: string }
  | {
      kind: LinkKind;
      phase: 'merge';
      mergeToken: string;
      organizations: MergeOrgPreview[];
      value: string;
      warning: string;
    };

const IDLE_FLOW: LinkFlowState = { kind: 'email', phase: 'idle' };

function memberRoleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return 'Dueño';
    case 'co_owner':
      return 'Co-dueño';
    case 'manager':
      return 'Gerente';
    case 'staff':
      return 'Staff';
    default:
      return role;
  }
}

export function EditProfileScreen(props: { onBack: () => void }): ReactElement {
  const profileChrome = useProfileChromeOptional();
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [identities, setIdentities] = useState<IdentityMe | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLinkBusy, setIsLinkBusy] = useState(false);
  const [linkFlow, setLinkFlow] = useState<LinkFlowState>(IDLE_FLOW);
  const [initial, setInitial] = useState({ fullName: '', preferredName: '' });

  const loadIdentities = useCallback(async (): Promise<void> => {
    try {
      const me = await getMyIdentities();
      setIdentities(me);
    } catch {
      // Fallback from session if API unavailable (e.g. migration not applied).
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        return;
      }
      const email = user.email?.trim() ?? '';
      const realEmail = email && !/@auth\.nexolia\.app$/i.test(email) ? email : null;
      const phone =
        (typeof user.phone === 'string' && user.phone.trim()) ||
        (typeof user.user_metadata?.auth_phone === 'string'
          ? String(user.user_metadata.auth_phone).trim()
          : '') ||
        null;
      setIdentities({
        email: realEmail,
        emailVerified: Boolean(realEmail),
        phone: phone || null,
        phoneVerified: Boolean(phone),
      });
    }
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) {
        return;
      }

      const nextFullName = String(user.user_metadata?.full_name ?? '');
      const nextPreferredName = String(user.user_metadata?.preferred_name ?? '');
      setFullName(nextFullName);
      setPreferredName(nextPreferredName);
      setInitial({ fullName: nextFullName, preferredName: nextPreferredName });
    });
    void loadIdentities();
  }, [loadIdentities]);

  const dirty = useMemo(
    () => fullName !== initial.fullName || preferredName !== initial.preferredName,
    [fullName, initial.fullName, initial.preferredName, preferredName],
  );

  useAndroidUnsavedBack({ dirty, onDiscard: props.onBack });

  async function handleSave(): Promise<void> {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert('Nombre requerido', 'Ingresá tu nombre completo para continuar.');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          preferred_name: preferredName.trim() || null,
        },
      });

      if (error) {
        throw error;
      }

      await profileChrome?.refreshProfile();
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
      props.onBack();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  }

  function openLinkFlow(kind: LinkKind): void {
    setLinkFlow({ kind, phase: 'enter', value: '' });
  }

  function closeLinkFlow(): void {
    if (isLinkBusy) {
      return;
    }
    setLinkFlow(IDLE_FLOW);
  }

  async function handleSendLinkCode(): Promise<void> {
    if (linkFlow.phase !== 'enter') {
      return;
    }

    setIsLinkBusy(true);
    try {
      if (linkFlow.kind === 'email') {
        await requestEmailIdentityLink(linkFlow.value);
      } else {
        await requestWhatsAppIdentityLink(linkFlow.value);
      }
      setLinkFlow({
        kind: linkFlow.kind,
        phase: 'otp',
        value: linkFlow.value.trim(),
        code: '',
      });
    } catch (error) {
      Alert.alert(
        'No se pudo enviar el código',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsLinkBusy(false);
    }
  }

  async function handleVerifyLinkCode(): Promise<void> {
    if (linkFlow.phase !== 'otp') {
      return;
    }

    setIsLinkBusy(true);
    try {
      const result =
        linkFlow.kind === 'email'
          ? await verifyEmailIdentityLink({ code: linkFlow.code, email: linkFlow.value })
          : await verifyWhatsAppIdentityLink({ code: linkFlow.code, phone: linkFlow.value });

      if (result.status === 'merge_required') {
        setLinkFlow({
          kind: linkFlow.kind,
          phase: 'merge',
          mergeToken: result.mergeToken,
          organizations: result.organizations,
          value: linkFlow.value,
          warning: result.warning,
        });
        return;
      }

      await onLinkSuccess(result.identities);
    } catch (error) {
      Alert.alert(
        'No se pudo verificar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsLinkBusy(false);
    }
  }

  async function handleConfirmMerge(): Promise<void> {
    if (linkFlow.phase !== 'merge') {
      return;
    }

    setIsLinkBusy(true);
    try {
      const identitiesAfter = await confirmIdentityMerge(linkFlow.mergeToken);
      await onLinkSuccess(identitiesAfter);
    } catch (error) {
      Alert.alert(
        'No se pudo unificar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsLinkBusy(false);
    }
  }

  async function onLinkSuccess(next: IdentityMe): Promise<void> {
    setIdentities(next);
    setLinkFlow(IDLE_FLOW);
    await profileChrome?.refreshProfile();
    try {
      await listMyOrganizations();
    } catch {
      // Negocios refreshes on focus; ignore here.
    }
    Alert.alert(
      'Identidad vinculada',
      'Ya podés ingresar con ambos métodos. Revisá Negocios para ver todos tus negocios.',
    );
  }

  const emailLabel = identities?.emailVerified && identities.email ? identities.email : 'Sin correo';
  const phoneLabel =
    identities?.phoneVerified && identities.phone ? identities.phone : 'Sin teléfono';

  return (
    <ScreenContent title="Actualizar perfil">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Actualizar perfil" />
        </View>
      </View>

      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Cómo ingresás</Text>
        <Text style={styles.sectionHint}>
          Estos son tus métodos de ingreso verificados. Si te uniste por QR con teléfono y también
          tenés correo, vinculá ambos acá para ver todos tus negocios en una sola sesión.
        </Text>

        <View style={styles.identityRow}>
          <View style={styles.flex}>
            <Text style={styles.identityLabel}>Correo</Text>
            <Text style={styles.identityValue}>{emailLabel}</Text>
          </View>
          {identities?.emailVerified ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Verificado</Text>
            </View>
          ) : (
            <Pressable onPress={() => openLinkFlow('email')} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>Agregar y verificar</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.identityRow}>
          <View style={styles.flex}>
            <Text style={styles.identityLabel}>Teléfono</Text>
            <Text style={styles.identityValue}>{phoneLabel}</Text>
          </View>
          {identities?.phoneVerified ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Verificado</Text>
            </View>
          ) : (
            <Pressable onPress={() => openLinkFlow('phone')} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>Agregar y verificar</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <Card style={styles.formCard}>
        <TextField
          label="Nombre completo *"
          onChangeText={setFullName}
          placeholder="Tu nombre completo"
          value={fullName}
        />
        <TextField
          label="Nombre preferido"
          onChangeText={setPreferredName}
          placeholder="Cómo querés que te salude la app"
          value={preferredName}
        />
        <PrimaryButton
          disabled={isSaving}
          fullWidth
          label={isSaving ? 'Guardando…' : 'Guardar cambios'}
          onPress={() => void handleSave()}
        />
      </Card>

      <Modal
        animationType="slide"
        onRequestClose={closeLinkFlow}
        transparent
        visible={linkFlow.phase !== 'idle'}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {linkFlow.phase === 'enter' ? (
              <>
                <Text style={styles.modalTitle}>
                  {linkFlow.kind === 'email' ? 'Vincular correo' : 'Vincular teléfono'}
                </Text>
                <TextField
                  autoCapitalize="none"
                  keyboardType={linkFlow.kind === 'email' ? 'email-address' : 'phone-pad'}
                  label={linkFlow.kind === 'email' ? 'Correo' : 'Teléfono (WhatsApp)'}
                  onChangeText={(value) =>
                    setLinkFlow({ kind: linkFlow.kind, phase: 'enter', value })
                  }
                  placeholder={linkFlow.kind === 'email' ? 'tu@correo.com' : '+54…'}
                  value={linkFlow.value}
                />
                <PrimaryButton
                  disabled={isLinkBusy || !linkFlow.value.trim()}
                  fullWidth
                  label={isLinkBusy ? 'Enviando…' : 'Enviar código'}
                  onPress={() => void handleSendLinkCode()}
                />
                <Pressable disabled={isLinkBusy} onPress={closeLinkFlow}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
              </>
            ) : null}

            {linkFlow.phase === 'otp' ? (
              <>
                <Text style={styles.modalTitle}>Ingresá el código</Text>
                <Text style={styles.sectionHint}>
                  {linkFlow.kind === 'email'
                    ? `Enviamos un código de 6 dígitos a ${linkFlow.value}.`
                    : `Enviamos un código por WhatsApp a ${linkFlow.value}. Este mensaje viene de Nexolia, no del WhatsApp de tu negocio.`}
                </Text>
                <TextField
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  label={`Código de ${getOtpCodeLength(linkFlow.kind === 'email' ? 'email' : 'whatsapp')} dígitos`}
                  maxLength={6}
                  onChangeText={(value) =>
                    setLinkFlow({
                      ...linkFlow,
                      code: normalizeOtpInput(
                        value,
                        linkFlow.kind === 'email' ? 'email' : 'whatsapp',
                      ),
                    })
                  }
                  placeholder="000000"
                  textContentType="oneTimeCode"
                  value={linkFlow.code}
                />
                <PrimaryButton
                  disabled={
                    isLinkBusy ||
                    !isOtpCodeComplete(
                      linkFlow.code,
                      linkFlow.kind === 'email' ? 'email' : 'whatsapp',
                    )
                  }
                  fullWidth
                  label={isLinkBusy ? 'Verificando…' : 'Verificar'}
                  onPress={() => void handleVerifyLinkCode()}
                />
                <Pressable
                  disabled={isLinkBusy}
                  onPress={() =>
                    setLinkFlow({ kind: linkFlow.kind, phase: 'enter', value: linkFlow.value })
                  }
                >
                  <Text style={styles.cancelText}>Cambiar dato</Text>
                </Pressable>
                <Pressable disabled={isLinkBusy} onPress={closeLinkFlow}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
              </>
            ) : null}

            {linkFlow.phase === 'merge' ? (
              <>
                <Text style={styles.modalTitle}>Unificar cuentas</Text>
                <Text style={styles.sectionHint}>{linkFlow.warning}</Text>
                {linkFlow.organizations.length > 0 ? (
                  <View style={styles.mergeList}>
                    <Text style={styles.identityLabel}>Negocios que se agregan:</Text>
                    {linkFlow.organizations.map((org) => (
                      <Text key={org.organizationId} style={styles.mergeItem}>
                        • {org.name} ({memberRoleLabel(org.role)})
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.sectionHint}>
                    La otra cuenta no tiene negocios activos; igual se unifica el método de ingreso.
                  </Text>
                )}
                <PrimaryButton
                  disabled={isLinkBusy}
                  fullWidth
                  label={isLinkBusy ? 'Unificando…' : 'Confirmar unificación'}
                  onPress={() => void handleConfirmMerge()}
                />
                <Pressable disabled={isLinkBusy} onPress={closeLinkFlow}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backPressable: {
    marginLeft: -6,
    marginTop: -4,
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    width: 28,
  },
  badge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelText: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  formCard: {
    gap: 14,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 4,
  },
  identityLabel: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  identityValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  linkButton: {
    backgroundColor: colors.navy,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mergeItem: {
    color: colors.navy,
    fontSize: 14,
    lineHeight: 20,
  },
  mergeList: {
    gap: 4,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
});
