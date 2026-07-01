import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PrimaryButton } from '../components/Buttons';
import { ScreenContent, ScreenTitle } from '../components/ui';
import {
  filterContactOptions,
  loadDeviceContacts,
  type DeviceContactOption,
} from '../api/customers';
import { normalizePhoneNumber } from '../services/phone';
import {
  buildStaffInviteDeepLink,
  createStaffInvite,
  type StaffInviteRole,
} from '../api/staffInvites';
import { colors } from '../theme';
import type { OwnerDashboard } from '../types/dashboard';

const ROLE_OPTIONS: Array<{ label: string; value: StaffInviteRole }> = [
  { label: 'Empleado', value: 'employee' },
  { label: 'Administrador', value: 'manager' },
  { label: 'Co-dueño', value: 'co_owner' },
];

export function StaffInviteScreen(props: {
  dashboard: OwnerDashboard;
  onBack: () => void;
}): ReactElement {
  const [role, setRole] = useState<StaffInviteRole>('employee');
  const [phoneInput, setPhoneInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<DeviceContactOption[]>([]);
  const [contactQuery, setContactQuery] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const filteredContacts = useMemo(
    () => filterContactOptions(contacts, contactQuery),
    [contactQuery, contacts],
  );

  useEffect(() => {
    if (!contactsOpen || contacts.length > 0) {
      return;
    }

    setIsLoadingContacts(true);
    void loadDeviceContacts()
      .then(setContacts)
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar contactos.');
      })
      .finally(() => setIsLoadingContacts(false));
  }, [contacts, contactsOpen]);

  async function handleCreateInvite(): Promise<void> {
    const invitedPhoneE164 = normalizePhoneNumber(phoneInput);

    if (!invitedPhoneE164) {
      setErrorMessage('Ingresá un número válido o elegí un contacto.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const invite = await createStaffInvite({
        businessCenterId: props.dashboard.businessCenter?.id,
        invitedDisplayName: displayName.trim() || undefined,
        invitedPhoneE164,
        organizationId: props.dashboard.organization!.id,
        role,
      });

      setInviteLink(buildStaffInviteDeepLink(invite.inviteToken));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo crear la invitación.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContent>
      <ScreenTitle subtitle="Invitá a tu equipo con QR" title="Agregar miembro" />
      <Pressable onPress={props.onBack}>
        <Text style={styles.backLink}>‹ Volver</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>Rol</Text>
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setRole(option.value)}
              style={[styles.roleChip, role === option.value && styles.roleChipActive]}
            >
              <Text style={[styles.roleChipText, role === option.value && styles.roleChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Teléfono del miembro</Text>
        <TextInput
          keyboardType="phone-pad"
          onChangeText={setPhoneInput}
          placeholder="+5411… o 011…"
          style={styles.input}
          value={phoneInput}
        />
        <PrimaryButton label="Elegir de contactos" onPress={() => setContactsOpen(true)} />

        <Text style={styles.label}>Nombre (opcional)</Text>
        <TextInput
          onChangeText={setDisplayName}
          placeholder="Nombre del contacto"
          style={styles.input}
          value={displayName}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? 'Generando…' : 'Generar QR'}
          onPress={() => void handleCreateInvite()}
        />
      </View>

      {inviteLink ? (
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>QR de invitación</Text>
          <Text style={styles.qrBody}>
            La persona debe verificar el mismo número ({phoneInput}) al escanear el código.
          </Text>
          <View style={styles.qrWrap}>
            <QRCode size={180} value={inviteLink} />
          </View>
          <Text selectable style={styles.linkText}>
            {inviteLink}
          </Text>
        </View>
      ) : null}

      <Modal animationType="slide" visible={contactsOpen}>
        <View style={styles.modalRoot}>
          <Text style={styles.modalTitle}>Contactos</Text>
          <TextInput
            onChangeText={setContactQuery}
            placeholder="Buscar contacto"
            style={styles.input}
            value={contactQuery}
          />
          {isLoadingContacts ? <ActivityIndicator color={colors.primary} /> : null}
          <FlatList
            data={filteredContacts}
            keyExtractor={(item, index) => `${item.displayName}-${item.rawPhone}-${index}`}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setPhoneInput(item.phoneE164 ?? item.rawPhone);
                  setDisplayName(item.displayName);
                  setContactsOpen(false);
                }}
                style={styles.contactRow}
              >
                <Text style={styles.contactName}>{item.displayName}</Text>
                <Text style={styles.contactPhone}>{item.phoneE164 ?? item.rawPhone}</Text>
              </Pressable>
            )}
          />
          <PrimaryButton label="Cerrar" onPress={() => setContactsOpen(false)} />
        </View>
      </Modal>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backLink: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  contactName: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  contactPhone: {
    color: colors.slate,
    fontSize: 12,
  },
  contactRow: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    gap: 2,
    paddingVertical: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  input: {
    borderColor: colors.borderInput,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  linkText: {
    color: colors.slate,
    fontSize: 11,
    textAlign: 'center',
  },
  modalRoot: {
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    padding: 16,
    paddingTop: 48,
  },
  modalTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
  },
  qrBody: {
    color: colors.slate,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginTop: 16,
    padding: 16,
  },
  qrTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  qrWrap: {
    backgroundColor: colors.surface,
    padding: 12,
  },
  roleChip: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roleChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  roleChipText: {
    color: colors.slate,
    fontSize: 11,
  },
  roleChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
