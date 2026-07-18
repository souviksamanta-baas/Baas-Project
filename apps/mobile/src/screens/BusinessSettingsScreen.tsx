import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
  getOrganizationProfile,
  updateOrganizationProfile,
  type OrganizationProfile,
} from '../api/organizationProfile';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, TextField, colors as dsColors, spacing } from '../design-system';
import { buildTimezoneOptions, formatTimezoneOptionLabel } from '../lib/timezones';
import { colors } from '../theme';

function emptyProfile(organizationId: string, fallbackName: string, fallbackTimezone: string): OrganizationProfile {
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
    timezone: fallbackTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Cordoba',
  };
}

export function BusinessSettingsScreen(props: {
  fallbackName: string;
  fallbackTimezone: string;
  onBack: () => void;
  onSaved: () => Promise<void>;
  organizationId: string;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const timezoneOptions = useMemo(() => buildTimezoneOptions(), []);
  const [profile, setProfile] = useState<OrganizationProfile>(() =>
    emptyProfile(props.organizationId, props.fallbackName, props.fallbackTimezone),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [timezonePickerOpen, setTimezonePickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getOrganizationProfile(props.organizationId)
      .then((next) => {
        if (!cancelled) {
          setProfile(next);
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
  }, [props.organizationId]);

  async function handleSave(): Promise<void> {
    setIsSaving(true);

    try {
      await updateOrganizationProfile({
        organizationId: props.organizationId,
        profile: {
          addressLine1: profile.addressLine1,
          addressLine2: profile.addressLine2,
          city: profile.city,
          contactEmail: profile.contactEmail,
          contactPhone: profile.contactPhone,
          country: profile.country,
          name: profile.name,
          postalCode: profile.postalCode,
          province: profile.province,
          timezone: profile.timezone,
        },
      });
      await props.onSaved();
      Alert.alert('Negocio actualizado', 'Los datos se guardaron correctamente.');
      props.onBack();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  }

  function patch<K extends keyof OrganizationProfile>(key: K, value: OrganizationProfile[K]): void {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <ScreenContent title="Configuracion del negocio">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle="Datos visibles de tu negocio en Nexolia"
            title="Configuracion del negocio"
          />
        </View>
      </View>

      <Card style={styles.formCard}>
        {isLoading ? (
          <Text style={styles.loadingText}>Cargando…</Text>
        ) : (
          <>
            <TextField
              label="Nombre del negocio *"
              onChangeText={(value) => patch('name', value)}
              placeholder="Ej. Panadería Don José"
              value={profile.name}
            />
            <TextField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email del negocio"
              onChangeText={(value) => patch('contactEmail', value)}
              placeholder="hola@tunegocio.com"
              value={profile.contactEmail}
            />
            <TextField
              keyboardType="phone-pad"
              label="Teléfono del negocio"
              onChangeText={(value) => patch('contactPhone', value)}
              placeholder="+54…"
              value={profile.contactPhone}
            />
            <TextField
              label="Dirección"
              onChangeText={(value) => patch('addressLine1', value)}
              placeholder="Calle y número"
              value={profile.addressLine1}
            />
            <TextField
              label="Piso / depto (opcional)"
              onChangeText={(value) => patch('addressLine2', value)}
              placeholder="Piso, depto, local"
              value={profile.addressLine2}
            />
            <TextField
              label="Ciudad"
              onChangeText={(value) => patch('city', value)}
              placeholder="Ciudad"
              value={profile.city}
            />
            <TextField
              label="Provincia"
              onChangeText={(value) => patch('province', value)}
              placeholder="Provincia"
              value={profile.province}
            />
            <TextField
              label="Código postal"
              onChangeText={(value) => patch('postalCode', value)}
              placeholder="CPA"
              value={profile.postalCode}
            />

            <Text style={styles.sectionLabel}>Zona horaria</Text>
            <Pressable onPress={() => setTimezonePickerOpen(true)} style={styles.dropdown}>
              <Text style={styles.dropdownValue}>
                {formatTimezoneOptionLabel(profile.timezone)}
              </Text>
              <Text style={styles.dropdownChevron}>▾</Text>
            </Pressable>

            <PrimaryButton
              disabled={isSaving}
              fullWidth
              label={isSaving ? 'Guardando…' : 'Guardar cambios'}
              onPress={() => void handleSave()}
            />
          </>
        )}
      </Card>

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
              const selected = item.id === profile.timezone;
              return (
                <Pressable
                  onPress={() => {
                    patch('timezone', item.id);
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
  loadingText: {
    color: colors.slate,
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '600',
  },
});
