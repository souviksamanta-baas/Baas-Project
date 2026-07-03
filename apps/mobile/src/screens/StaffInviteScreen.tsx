import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PrimaryButton } from '../components/Buttons';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { TextField, colors as dsColors } from '../design-system';
import { listBusinessCenters } from '../api/dashboard';
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
  const [branchSelections, setBranchSelections] = useState<string[]>(['']);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    const organizationId = props.dashboard.organization?.id;
    if (!organizationId) {
      return;
    }

    void listBusinessCenters(organizationId).then((items) => {
      setBranches(items);
      if (items.length > 0) {
        setBranchSelections([items[0]!.id]);
      }
    });
  }, [props.dashboard.organization?.id]);

  function updateBranchSelection(index: number, businessCenterId: string): void {
    setBranchSelections((current) => current.map((value, itemIndex) => (itemIndex === index ? businessCenterId : value)));
  }

  function addBranchRow(): void {
    setBranchSelections((current) => [...current, branches[0]?.id ?? '']);
  }

  async function handleCreateInvite(): Promise<void> {
    const invitedPhoneE164 = normalizePhoneNumber(phoneInput);
    const trimmedName = displayName.trim();
    const selectedBranches = [...new Set(branchSelections.filter(Boolean))];

    if (!trimmedName) {
      setErrorMessage('Ingresá el nombre del miembro.');
      return;
    }

    if (!invitedPhoneE164) {
      setErrorMessage('Ingresá un número válido.');
      return;
    }

    if (selectedBranches.length === 0) {
      setErrorMessage('Seleccioná al menos una sucursal.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const invite = await createStaffInvite({
        businessCenterIds: selectedBranches,
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
    <ScreenContent>
      <ScreenTitle subtitle="Compartí un QR para sumar a tu equipo" title="Invitar miembro" />
      <Pressable onPress={props.onBack}>
        <Text style={styles.backLink}>‹ Volver</Text>
      </Pressable>

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

        <TextField
          keyboardType="phone-pad"
          label="Teléfono del miembro *"
          onChangeText={setPhoneInput}
          placeholder="+5411… o 011…"
          value={phoneInput}
        />

        <TextField
          label="Nombre *"
          onChangeText={setDisplayName}
          placeholder="Nombre y apellido"
          value={displayName}
        />

        <Text style={styles.sectionLabel}>Sucursales</Text>
        {branchSelections.map((selection, index) => (
          <View key={`branch-${index}`} style={styles.branchRow}>
            <View style={styles.branchPicker}>
              {branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  onPress={() => updateBranchSelection(index, branch.id)}
                  style={[styles.branchChip, selection === branch.id && styles.branchChipActive]}
                >
                  <Text
                    style={[styles.branchChipText, selection === branch.id && styles.branchChipTextActive]}
                  >
                    {branch.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Pressable onPress={addBranchRow} style={styles.addBranchButton}>
          <Text style={styles.addBranchText}>+ Agregar sucursal</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <PrimaryButton
          disabled={isSubmitting}
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
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  addBranchButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addBranchText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  backLink: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
  },
  branchChip: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  branchChipActive: {
    backgroundColor: dsColors.primarySoft,
    borderColor: colors.primary,
  },
  branchChipText: {
    color: colors.slate,
    fontSize: 11,
  },
  branchChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  branchPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  branchRow: {
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  formCard: {
    gap: 14,
    padding: 16,
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
