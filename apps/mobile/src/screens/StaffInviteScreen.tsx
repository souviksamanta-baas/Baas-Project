import type { ReactElement } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ContactPickerModal } from '../components/ContactPickerModal';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, TextField, colors as dsColors } from '../design-system';
import {
  buildStaffInviteDeepLink,
  createStaffInvite,
  type StaffInviteRole,
} from '../api/staffInvites';
import { normalizePhoneNumber } from '../services/phone';
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
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function handleCreateInvite(): Promise<void> {
    const invitedPhoneE164 = normalizePhoneNumber(phoneInput);
    const trimmedName = displayName.trim();
    const defaultCenterId = props.dashboard.businessCenter?.id;

    if (!trimmedName) {
      setErrorMessage('Ingresá el nombre del miembro.');
      return;
    }

    if (!invitedPhoneE164) {
      setErrorMessage('Ingresá un número válido.');
      return;
    }

    if (!defaultCenterId) {
      setErrorMessage('No hay una sucursal activa para asignar la invitación.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const invite = await createStaffInvite({
        businessCenterId: defaultCenterId,
        invitedDisplayName: trimmedName,
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
    <ScreenContent title="Invitar miembro">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle subtitle="Compartí un QR para sumar a tu equipo" title="Invitar miembro" />
        </View>
      </View>

      <Card style={styles.formCard}>
        <Text style={styles.sectionLabel}>Rol</Text>
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

        <Pressable onPress={() => setContactPickerOpen(true)} style={styles.contactLink}>
          <Text style={styles.contactLinkText}>+ Agregar desde contactos</Text>
        </Pressable>

        <TextField
          label="Nombre *"
          onChangeText={setDisplayName}
          placeholder="Nombre y apellido"
          value={displayName}
        />

        <TextField
          keyboardType="phone-pad"
          label="Teléfono del miembro *"
          onChangeText={setPhoneInput}
          placeholder="+5411… o 011…"
          value={phoneInput}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <PrimaryButton
          disabled={isSubmitting}
          fullWidth
          label={isSubmitting ? 'Generando…' : 'Generar QR'}
          onPress={() => void handleCreateInvite()}
        />
      </Card>

      {inviteLink ? (
        <Card style={styles.qrCard}>
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
        </Card>
      ) : null}

      <ContactPickerModal
        onClose={() => setContactPickerOpen(false)}
        onSelect={(contact) => {
          setDisplayName(contact.displayName);
          setPhoneInput(contact.phoneE164 ?? contact.rawPhone);
          setContactPickerOpen(false);
          setErrorMessage(null);
        }}
        visible={contactPickerOpen}
      />
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
  contactLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  contactLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
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
  linkText: {
    color: colors.slate,
    fontSize: 11,
    textAlign: 'center',
  },
  qrBody: {
    color: colors.slate,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  qrCard: {
    alignItems: 'center',
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
    backgroundColor: dsColors.primarySoft,
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
  sectionLabel: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
});
