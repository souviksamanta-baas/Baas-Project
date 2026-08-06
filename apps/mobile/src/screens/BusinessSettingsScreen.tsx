import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  listOrganizationMembers,
  removeOrganizationMember,
  type OrganizationMember,
} from '../api/accountLifecycle';
import {
  getOrganizationProfile,
  updateOrganizationProfile,
  type OrganizationProfile,
} from '../api/organizationProfile';
import { Icon } from '../components/icons';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, TextField, colors as dsColors, spacing } from '../design-system';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { buildTimezoneOptions, formatTimezoneOptionLabel } from '../lib/timezones';
import { colors } from '../theme';

type EditSection = 'name' | 'email' | 'address' | 'timezone' | null;

function emptyProfile(
  organizationId: string,
  fallbackName: string,
  fallbackTimezone: string,
): OrganizationProfile {
  return {
    addressLine1: '',
    addressLine2: '',
    city: '',
    contactEmail: '',
    contactPhone: '',
    country: 'AR',
    id: organizationId,
    name: fallbackName,
    postalCode: '',
    province: '',
    timezone:
      fallbackTimezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'America/Argentina/Cordoba',
  };
}

function formatAddress(profile: OrganizationProfile): string {
  const parts = [
    profile.addressLine1.trim(),
    profile.addressLine2.trim(),
    profile.city.trim(),
    profile.province.trim(),
    profile.postalCode.trim(),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Sin dirección';
}

function memberRoleLabel(role: string): string {
  if (role === 'owner') {
    return 'Dueño';
  }
  return 'Equipo';
}

export function BusinessSettingsScreen(props: {
  fallbackName: string;
  fallbackTimezone: string;
  onBack: () => void;
  onSaved: () => Promise<void>;
  organizationId: string;
  whatsappPhone: string | null;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const timezoneOptions = useMemo(() => buildTimezoneOptions(), []);
  const [profile, setProfile] = useState<OrganizationProfile>(() =>
    emptyProfile(props.organizationId, props.fallbackName, props.fallbackTimezone),
  );
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [draft, setDraft] = useState<OrganizationProfile | null>(null);
  const [timezonePickerOpen, setTimezonePickerOpen] = useState(false);

  const loadMembers = useCallback(async (): Promise<void> => {
    const next = await listOrganizationMembers(props.organizationId);
    setMembers(next);
  }, [props.organizationId]);

  useAndroidBackHandler(Boolean(editSection) || timezonePickerOpen, () => {
    if (timezonePickerOpen) {
      setTimezonePickerOpen(false);
      return true;
    }
    if (editSection) {
      setEditSection(null);
      setDraft(null);
      return true;
    }
    return false;
  });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getOrganizationProfile(props.organizationId), loadMembers()])
      .then(([nextProfile]) => {
        if (!cancelled) {
          setProfile(nextProfile);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          Alert.alert(
            'No se pudo cargar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadMembers, props.organizationId]);

  function openEdit(section: Exclude<EditSection, null>): void {
    setDraft({ ...profile });
    setEditSection(section);
  }

  function closeEdit(): void {
    setEditSection(null);
    setDraft(null);
    setTimezonePickerOpen(false);
  }

  function patchDraft<K extends keyof OrganizationProfile>(
    key: K,
    value: OrganizationProfile[K],
  ): void {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveDraft(): Promise<void> {
    if (!draft) {
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganizationProfile({
        organizationId: props.organizationId,
        profile: {
          addressLine1: draft.addressLine1,
          addressLine2: draft.addressLine2,
          city: draft.city,
          contactEmail: draft.contactEmail,
          contactPhone: profile.contactPhone,
          country: draft.country,
          name: draft.name,
          postalCode: draft.postalCode,
          province: draft.province,
          timezone: draft.timezone,
        },
      });
      setProfile(draft);
      await props.onSaved();
      closeEdit();
      Alert.alert('Negocio actualizado', 'Los datos se guardaron correctamente.');
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  }

  function confirmRemoveMember(member: OrganizationMember): void {
    Alert.alert(
      'Eliminar miembro',
      `¿Querés eliminar a ${member.displayName} del negocio?`,
      [
        { style: 'cancel', text: 'Cancelar' },
        {
          style: 'destructive',
          text: 'Eliminar',
          onPress: () => {
            void handleRemoveMember(member);
          },
        },
      ],
    );
  }

  async function handleRemoveMember(member: OrganizationMember): Promise<void> {
    setRemovingUserId(member.userId);
    try {
      await removeOrganizationMember({
        organizationId: props.organizationId,
        userId: member.userId,
      });
      await loadMembers();
      Alert.alert('Miembro eliminado', `${member.displayName} ya no forma parte del negocio.`);
    } catch (error) {
      Alert.alert(
        'No se pudo eliminar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setRemovingUserId(null);
    }
  }

  const phoneDisplay = props.whatsappPhone?.trim() || 'Sin número de WhatsApp';
  const editTitle =
    editSection === 'name'
      ? 'Editar nombre'
      : editSection === 'email'
        ? 'Editar email'
        : editSection === 'address'
          ? 'Editar dirección'
          : editSection === 'timezone'
            ? 'Editar zona horaria'
            : '';

  return (
    <ScreenContent title="Configuracion del negocio">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle="Resumen del negocio y equipo"
            title="Configuracion del negocio"
          />
        </View>
      </View>

      <Card style={styles.summaryCard}>
        {isLoading ? (
          <Text style={styles.loadingText}>Cargando…</Text>
        ) : (
          <>
            <SummaryRow
              label="Nombre"
              onEdit={() => openEdit('name')}
              value={profile.name || 'Sin nombre'}
            />
            <SummaryRow
              label="Email"
              onEdit={() => openEdit('email')}
              value={profile.contactEmail.trim() || 'Sin email'}
            />
            <SummaryRow
              editable={false}
              hint="Número de WhatsApp Business"
              label="Teléfono"
              value={phoneDisplay}
            />
            <SummaryRow
              label="Dirección"
              onEdit={() => openEdit('address')}
              value={formatAddress(profile)}
            />
            <SummaryRow
              label="Zona horaria"
              onEdit={() => openEdit('timezone')}
              value={formatTimezoneOptionLabel(profile.timezone)}
            />
          </>
        )}
      </Card>

      <Card style={styles.membersCard}>
        <View style={styles.membersHeader}>
          <Text style={styles.membersTitle}>Miembros</Text>
          <Text style={styles.membersCount}>
            {members.length === 1 ? '1 persona' : `${members.length} personas`}
          </Text>
        </View>

        {isLoading ? (
          <Text style={styles.loadingText}>Cargando…</Text>
        ) : members.length === 0 ? (
          <Text style={styles.loadingText}>No hay miembros cargados.</Text>
        ) : (
          <>
            {members.map((member, index) => {
              const canDelete = member.role !== 'owner';
              const fullName = member.displayName.trim() || member.email || 'Miembro';
              return (
                <View
                  key={member.userId}
                  style={[styles.memberRow, index < members.length - 1 && styles.memberRowDivider]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.memberName}>{fullName}</Text>
                    <Text style={styles.memberMeta}>{memberRoleLabel(member.role)}</Text>
                    {member.email && member.email !== fullName ? (
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    ) : null}
                  </View>
                  {canDelete ? (
                    <Pressable
                      accessibilityLabel={`Eliminar a ${fullName}`}
                      disabled={removingUserId === member.userId}
                      hitSlop={8}
                      onPress={() => confirmRemoveMember(member)}
                      style={styles.deleteAction}
                    >
                      <Icon
                        color={removingUserId === member.userId ? colors.slate : colors.danger}
                        kind="trash"
                        size={16}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.deleteActionLabel,
                          removingUserId === member.userId && styles.deleteActionLabelDisabled,
                        ]}
                      >
                        {removingUserId === member.userId ? '…' : 'Eliminar'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {members.every((member) => member.role === 'owner') ? (
              <Text style={styles.membersHint}>
                Cuando invites al equipo, vas a poder eliminarlos desde aquí.
              </Text>
            ) : (
              <Text style={styles.membersHint}>
                Tocá Eliminar para sacar a un miembro del negocio. El dueño no se puede eliminar.
              </Text>
            )}
          </>
        )}
      </Card>

      <Modal
        animationType="slide"
        onRequestClose={closeEdit}
        visible={editSection != null && draft != null}
      >
        <View style={[styles.pickerRoot, { paddingTop: Math.max(insets.top, spacing.md) }]}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={closeEdit}>
              <Text style={styles.pickerClose}>Cerrar</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>{editTitle}</Text>
            <View style={styles.pickerHeaderSpacer} />
          </View>

          <View style={styles.editBody}>
            {editSection === 'name' && draft ? (
              <TextField
                label="Nombre del negocio *"
                onChangeText={(value) => patchDraft('name', value)}
                placeholder="Ej. Panadería Don José"
                value={draft.name}
              />
            ) : null}

            {editSection === 'email' && draft ? (
              <TextField
                autoCapitalize="none"
                keyboardType="email-address"
                label="Email del negocio"
                onChangeText={(value) => patchDraft('contactEmail', value)}
                placeholder="hola@tunegocio.com"
                value={draft.contactEmail}
              />
            ) : null}

            {editSection === 'address' && draft ? (
              <>
                <TextField
                  label="Dirección"
                  onChangeText={(value) => patchDraft('addressLine1', value)}
                  placeholder="Calle y número"
                  value={draft.addressLine1}
                />
                <TextField
                  label="Piso / depto (opcional)"
                  onChangeText={(value) => patchDraft('addressLine2', value)}
                  placeholder="Piso, depto, local"
                  value={draft.addressLine2}
                />
                <TextField
                  label="Ciudad"
                  onChangeText={(value) => patchDraft('city', value)}
                  placeholder="Ciudad"
                  value={draft.city}
                />
                <TextField
                  label="Provincia"
                  onChangeText={(value) => patchDraft('province', value)}
                  placeholder="Provincia"
                  value={draft.province}
                />
                <TextField
                  label="Código postal"
                  onChangeText={(value) => patchDraft('postalCode', value)}
                  placeholder="CPA"
                  value={draft.postalCode}
                />
              </>
            ) : null}

            {editSection === 'timezone' && draft ? (
              <>
                <Text style={styles.sectionLabel}>Zona horaria</Text>
                <Pressable onPress={() => setTimezonePickerOpen(true)} style={styles.dropdown}>
                  <Text style={styles.dropdownValue}>
                    {formatTimezoneOptionLabel(draft.timezone)}
                  </Text>
                  <Text style={styles.dropdownChevron}>▾</Text>
                </Pressable>
              </>
            ) : null}

            <PrimaryButton
              disabled={isSaving}
              fullWidth
              label={isSaving ? 'Guardando…' : 'Guardar cambios'}
              onPress={() => void saveDraft()}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setTimezonePickerOpen(false)}
        visible={timezonePickerOpen}
      >
        <View style={[styles.pickerRoot, { paddingTop: Math.max(insets.top, spacing.md) }]}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setTimezonePickerOpen(false)}>
              <Text style={styles.pickerClose}>Cerrar</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Zona horaria</Text>
            <View style={styles.pickerHeaderSpacer} />
          </View>
          <FlatList
            data={timezoneOptions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const selected = item.id === draft?.timezone;
              return (
                <Pressable
                  onPress={() => {
                    patchDraft('timezone', item.id);
                    setTimezonePickerOpen(false);
                  }}
                  style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                >
                  <Text style={[styles.pickerRowLabel, selected && styles.pickerRowLabelSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </ScreenContent>
  );
}

function SummaryRow(props: {
  editable?: boolean;
  hint?: string;
  label: string;
  onEdit?: () => void;
  value: string;
}): ReactElement {
  const editable = props.editable !== false && Boolean(props.onEdit);

  return (
    <View style={styles.summaryRow}>
      <View style={styles.flex}>
        <Text style={styles.summaryLabel}>{props.label}</Text>
        <Text style={styles.summaryValue}>{props.value}</Text>
        {props.hint ? <Text style={styles.summaryHint}>{props.hint}</Text> : null}
      </View>
      {editable ? (
        <Pressable
          accessibilityLabel={`Editar ${props.label}`}
          hitSlop={8}
          onPress={props.onEdit}
          style={styles.pencilButton}
        >
          <Icon color={colors.primary} kind="edit" size={16} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
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
  deleteAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  deleteActionLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteActionLabelDisabled: {
    color: colors.slate,
  },
  dropdown: {
    alignItems: 'center',
    backgroundColor: dsColors.surface,
    borderColor: dsColors.borderInput,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownChevron: {
    color: colors.slate,
    fontSize: 16,
    marginLeft: 8,
  },
  dropdownValue: {
    color: colors.navy,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  editBody: {
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 4,
  },
  loadingText: {
    color: colors.slate,
    fontSize: 13,
  },
  memberEmail: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  memberMeta: {
    color: colors.slate,
    fontSize: 13,
    marginTop: 2,
  },
  memberName: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  memberRowDivider: {
    borderBottomColor: dsColors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  membersCard: {
    gap: 4,
    padding: 16,
  },
  membersCount: {
    color: colors.slate,
    fontSize: 13,
  },
  membersHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  membersHint: {
    color: colors.slate,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  membersTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  pencilButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pickerClose: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 64,
  },
  pickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pickerHeaderSpacer: {
    minWidth: 64,
  },
  pickerRoot: {
    backgroundColor: dsColors.background,
    flex: 1,
  },
  pickerRow: {
    borderBottomColor: dsColors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  pickerRowLabel: {
    color: colors.navy,
    fontSize: 15,
  },
  pickerRowLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  pickerRowSelected: {
    backgroundColor: dsColors.primarySoft,
  },
  pickerTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryCard: {
    gap: 0,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  summaryHint: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  summaryLabel: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  summaryRow: {
    alignItems: 'center',
    borderBottomColor: dsColors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  summaryValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 4,
  },
});
