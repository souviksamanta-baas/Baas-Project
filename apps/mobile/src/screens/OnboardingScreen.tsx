import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { Icon } from '../components/icons';
import { MultiSucursalesQuestion } from '../components/MultiSucursalesQuestion';
import { listOrganizationVerticals, type OrganizationVertical } from '../api/dashboard';
import { filterMoreMenuSections } from '../lib/moreMenu';
import {
  getNavShortcutOption,
  listNavShortcutOptions,
  type NavShortcutId,
  type NavShortcutOption,
} from '../lib/navShortcut';
import { parseStaffInviteToken } from '../lib/staffInviteToken';
import { colors } from '../theme';
import { styles as baseStyles } from '../styles';
import {
  DEFAULT_ORGANIZATION_FEATURE_FLAGS,
  resolveOrganizationFeatureFlags,
  type OrganizationFeatureFlags,
} from '../types/features';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

type OnboardingStep = 'choice' | 'create' | 'scan';

type ToggleItem = {
  hint?: string;
  key: keyof OrganizationFeatureFlags;
  label: string;
};

type ToggleGroup = {
  hint?: string;
  items: ToggleItem[];
  title: string;
};

const FEATURE_GROUPS: ToggleGroup[] = [
  {
    hint: 'Ventas, stock, compras y proveedores.',
    items: [
      { key: 'commerce_pos', label: 'Punto de venta' },
      { key: 'commerce_inventory', label: 'Inventario' },
      { key: 'commerce_lots', label: 'Lotes y movimientos' },
      { key: 'commerce_purchases', label: 'Compras' },
      { key: 'commerce_suppliers', label: 'Proveedores' },
      {
        hint: 'Muestra Ventas como atajo en el menú inferior.',
        key: 'commerce_nav_shortcut',
        label: 'Atajo Ventas en menú',
      },
    ],
    title: 'Comercio',
  },
  {
    hint: 'Presupuestos, facturas y caja.',
    items: [
      { key: 'billing_invoices', label: 'Facturas' },
      { key: 'billing_quotes', label: 'Presupuestos' },
      { key: 'billing_arca', label: 'ARCA (AFIP)' },
      { key: 'billing_cash', label: 'Caja' },
    ],
    title: 'Facturación',
  },
  {
    hint: 'Turnos, reservas y agenda de servicios.',
    items: [{ key: 'appointments', label: 'Turnos y agenda' }],
    title: 'Agenda',
  },
  {
    hint: 'Funciones avanzadas del asistente Copi.',
    items: [
      { key: 'copi_pro_agent', label: 'Copi Pro (acciones automáticas)' },
      { key: 'copi_voice', label: 'Copi con voz' },
      { key: 'copi_vision', label: 'Copi con visión' },
    ],
    title: 'Copi',
  },
  {
    hint: 'Notificaciones push para el equipo.',
    items: [{ key: 'notifications', label: 'Notificaciones push' }],
    title: 'Notificaciones',
  },
];

export function OnboardingScreen(props: {
  businessName: string;
  featureFlags: OrganizationFeatureFlags;
  initialStep?: OnboardingStep;
  isSubmitting: boolean;
  navShortcut: NavShortcutId;
  onBack?: () => void;
  onChangeBusinessName: (businessName: string) => void;
  onChangeFeatureFlags: (featureFlags: OrganizationFeatureFlags) => void;
  onChangeNavShortcut: (navShortcut: NavShortcutId) => void;
  onChangeVerticalId: (verticalId: string | null) => void;
  onCreateOrganization: () => void;
  onJoinWithInviteToken: (inviteToken: string) => void;
  onSignOut: () => void;
  submitLabel?: string;
  verticalId: string | null;
}): ReactElement {
  const [step, setStep] = useState<OnboardingStep>(props.initialStep ?? 'choice');
  const [verticals, setVerticals] = useState<OrganizationVertical[]>([]);
  const [verticalsLoading, setVerticalsLoading] = useState(false);
  const [verticalsError, setVerticalsError] = useState<string | null>(null);
  const [multiSucursales, setMultiSucursales] = useState<'yes' | 'no'>(
    props.featureFlags.multi_sucursales === true ? 'yes' : 'no',
  );

  const resolvedFlags = useMemo(
    () => resolveOrganizationFeatureFlags(props.featureFlags),
    [props.featureFlags],
  );

  const shortcutOptions: NavShortcutOption[] = useMemo(() => {
    const rawOptions = listNavShortcutOptions().filter((option) => !option.disabled);
    const allowedIds = new Set<string>(
      filterMoreMenuSections(props.featureFlags).flatMap((section) =>
        section.rows.map((row) => row.id),
      ),
    );
    return rawOptions.filter((option) => {
      if (option.id === 'ventas') {
        return resolvedFlags.commerce_pos === true;
      }
      return allowedIds.has(option.id);
    });
  }, [props.featureFlags, resolvedFlags.commerce_pos]);

  const selected = getNavShortcutOption(props.navShortcut);

  useEffect(() => {
    if (step !== 'create') {
      return;
    }
    let cancelled = false;
    setVerticalsLoading(true);
    setVerticalsError(null);

    void (async () => {
      try {
        const list = await listOrganizationVerticals();
        if (cancelled) {
          return;
        }
        setVerticals(list);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setVerticalsError(
          error instanceof Error ? error.message : 'No se pudieron cargar los rubros.',
        );
      } finally {
        if (!cancelled) {
          setVerticalsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step]);

  const onChangeNavShortcutRef = useRef(props.onChangeNavShortcut);
  useEffect(() => {
    onChangeNavShortcutRef.current = props.onChangeNavShortcut;
  }, [props.onChangeNavShortcut]);

  useEffect(() => {
    if (shortcutOptions.length === 0) {
      return;
    }
    const validIds = new Set<NavShortcutId>(shortcutOptions.map((option) => option.id));
    if (validIds.has(props.navShortcut)) {
      return;
    }
    const preferTasks =
      resolvedFlags.commerce_nav_shortcut !== true && resolvedFlags.commerce_pos !== true;
    const fallback = preferTasks
      ? (shortcutOptions.find((option) => option.id === 'notifications-tasks') ??
        shortcutOptions[0])
      : shortcutOptions[0];
    if (fallback) {
      onChangeNavShortcutRef.current(fallback.id);
    }
  }, [
    props.navShortcut,
    resolvedFlags.commerce_nav_shortcut,
    resolvedFlags.commerce_pos,
    shortcutOptions,
  ]);

  useEffect(() => {
    const nextChoice: 'yes' | 'no' = props.featureFlags.multi_sucursales === true ? 'yes' : 'no';
    setMultiSucursales((current) => (current === nextChoice ? current : nextChoice));
  }, [props.featureFlags.multi_sucursales]);

  const handleSelectVertical = useCallback(
    (vertical: OrganizationVertical) => {
      props.onChangeVerticalId(vertical.id);
      const merged: OrganizationFeatureFlags = {
        ...DEFAULT_ORGANIZATION_FEATURE_FLAGS,
        ...(vertical.suggested_feature_flags ?? {}),
      };
      props.onChangeFeatureFlags(merged);
    },
    [props],
  );

  const handleToggleFlag = useCallback(
    (key: keyof OrganizationFeatureFlags, value: boolean) => {
      const next: OrganizationFeatureFlags = {
        ...props.featureFlags,
        [key]: value,
      };
      props.onChangeFeatureFlags(next);
    },
    [props],
  );

  const handleChangeMultiSucursales = useCallback(
    (value: 'yes' | 'no') => {
      setMultiSucursales(value);
      const next: OrganizationFeatureFlags = {
        ...props.featureFlags,
        multi_sucursales: value === 'yes',
      };
      props.onChangeFeatureFlags(next);
    },
    [props],
  );

  if (step === 'choice') {
    return (
      <View style={baseStyles.card}>
        <Text style={baseStyles.heading}>¿Cómo querés continuar?</Text>
        <Text style={baseStyles.bodyText}>
          Si te invitaron a un negocio, escaneá el QR. Si todavía no estás registrado como
          propietario, completá el alta en la web.
        </Text>

        <PrimaryButton label="Unirme con invitación (QR)" onPress={() => setStep('scan')} />
        <View style={styles.spacer} />
        <SecondaryButton
          label="Abrir nexolia.com.ar/comenzar"
          onPress={() => {
            void Linking.openURL('https://nexolia.com.ar/comenzar');
          }}
        />

        <Pressable onPress={props.onSignOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'scan') {
    return (
      <Modal animationType="slide" onRequestClose={() => setStep('choice')} visible>
        <SafeAreaView edges={['top', 'bottom']} style={styles.scanModal}>
          <BarcodeScannerScreen
            hint="Apuntá al QR de invitación que te compartió el dueño"
            onBack={() => setStep('choice')}
            onScanned={({ unlock, value }) => {
              const token = parseStaffInviteToken(value);
              if (!token) {
                Alert.alert('QR inválido', 'Ese código no es una invitación de Nexolia.');
                unlock();
                return;
              }
              props.onJoinWithInviteToken(token);
            }}
            title="Escanear invitación"
          />
        </SafeAreaView>
      </Modal>
    );
  }

  // Self-serve create-org is retired: owners are provisioned via nexolia.com.ar.
  // Keep invite scan; if we landed on create, show the web gate instead.
  if (step === 'create' || props.initialStep === 'create') {
    return (
      <View style={baseStyles.card}>
        <Text style={baseStyles.heading}>Registro en la web</Text>
        <Text style={baseStyles.bodyText}>
          Ya no se crea el negocio desde la app. Completá el alta en nexolia.com.ar/comenzar y
          esperá la confirmación de Nexolia. Después iniciá sesión acá con el mismo email.
        </Text>
        <PrimaryButton
          label="Abrir /comenzar"
          onPress={() => {
            void Linking.openURL('https://nexolia.com.ar/comenzar');
          }}
        />
        <View style={styles.spacer} />
        <SecondaryButton label="Unirme con invitación (QR)" onPress={() => setStep('scan')} />
        <Pressable onPress={props.onSignOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.createRoot}>
      <ScrollView
        contentContainerStyle={styles.createScroll}
        keyboardShouldPersistTaps="handled"
        style={styles.flex}
      >
        <Pressable
          hitSlop={8}
          onPress={() => {
            if (props.onBack) {
              props.onBack();
              return;
            }
            if (props.initialStep === 'create') {
              props.onSignOut();
              return;
            }
            setStep('choice');
          }}
          style={styles.backRow}
        >
          <Text style={styles.backText}>
            {props.onBack
              ? '‹ Volver'
              : props.initialStep === 'create'
                ? '‹ Cerrar sesión'
                : '‹ Volver'}
          </Text>
        </Pressable>

        <Text style={baseStyles.heading}>
          {props.onBack ? 'Creá otro negocio' : 'Creá tu negocio'}
        </Text>
        <Text style={baseStyles.bodyText}>
          {props.onBack
            ? 'Vas a ser dueño de este negocio. Después podés cambiar entre negocios desde Mi cuenta → Negocios.'
            : 'Elegí el rubro, activá los módulos que necesitás y ponele nombre a tu negocio.'}
        </Text>

        <Text style={styles.sectionLabel}>Rubro</Text>
        <Text style={styles.sectionHint}>
          Elegí el que mejor describe a tu negocio. Vamos a activar los módulos sugeridos, pero
          podés ajustarlos abajo.
        </Text>
        {verticalsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Cargando rubros…</Text>
          </View>
        ) : verticalsError ? (
          <Text style={styles.errorText}>{verticalsError}</Text>
        ) : verticals.length === 0 ? (
          <Text style={styles.sectionHint}>No hay rubros disponibles.</Text>
        ) : (
          <View style={styles.verticalList}>
            {verticals.map((vertical) => {
              const isSelected = props.verticalId === vertical.id;
              return (
                <Pressable
                  key={vertical.id}
                  onPress={() => handleSelectVertical(vertical)}
                  style={[styles.verticalRow, isSelected && styles.verticalRowSelected]}
                >
                  <View style={styles.verticalContent}>
                    <Text
                      style={[
                        styles.verticalTitle,
                        isSelected && styles.verticalTitleSelected,
                      ]}
                    >
                      {vertical.display_name}
                    </Text>
                    {vertical.description ? (
                      <Text style={styles.verticalDescription}>{vertical.description}</Text>
                    ) : null}
                  </View>
                  {isSelected ? <Text style={styles.verticalCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionLabel}>Nombre del negocio</Text>
        <TextInput
          onChangeText={props.onChangeBusinessName}
          placeholder="Mi negocio"
          style={baseStyles.input}
          value={props.businessName}
        />

        <Text style={styles.sectionLabel}>Módulos</Text>
        <Text style={styles.sectionHint}>
          Activá solo lo que vas a usar. Podés cambiarlo después desde Configuración del negocio.
        </Text>
        {FEATURE_GROUPS.map((group) => (
          <View key={group.title} style={styles.toggleGroup}>
            <Text style={styles.toggleGroupTitle}>{group.title}</Text>
            {group.hint ? <Text style={styles.toggleGroupHint}>{group.hint}</Text> : null}
            {group.items.map((item) => {
              const value = resolvedFlags[item.key] === true;
              return (
                <View key={item.key} style={styles.toggleRow}>
                  <View style={styles.toggleLabels}>
                    <Text style={styles.toggleLabel}>{item.label}</Text>
                    {item.hint ? <Text style={styles.toggleHint}>{item.hint}</Text> : null}
                  </View>
                  <Switch
                    onValueChange={(next) => handleToggleFlag(item.key, next)}
                    thumbColor={value ? colors.primary : '#f4f4f5'}
                    trackColor={{ false: '#d4dbe1', true: colors.primaryLight }}
                    value={value}
                  />
                </View>
              );
            })}
          </View>
        ))}

        <View style={styles.sucursalesBlock}>
          <MultiSucursalesQuestion
            disabled={false}
            onChange={handleChangeMultiSucursales}
            value={multiSucursales}
          />
        </View>

        <Text style={styles.sectionLabel}>Atajo del menú</Text>
        <Text style={styles.sectionHint}>
          Elegido: {selected.title}. Podés cambiarlo después en Configuración del negocio.
        </Text>
        {shortcutOptions.length === 0 ? (
          <Text style={styles.sectionHint}>
            Activá algún módulo para elegir el atajo del menú inferior.
          </Text>
        ) : (
          <View style={styles.shortcutList}>
            {shortcutOptions.map((option) => {
              const isSelected = option.id === props.navShortcut;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => props.onChangeNavShortcut(option.id)}
                  style={[styles.shortcutRow, isSelected && styles.shortcutRowSelected]}
                >
                  {option.id === 'ventas' ? (
                    <Text style={styles.cash}>$</Text>
                  ) : (
                    <Icon color={colors.primary} kind={option.icon} size={18} strokeWidth={2} />
                  )}
                  <Text style={[styles.shortcutLabel, isSelected && styles.shortcutLabelSelected]}>
                    {option.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          disabled={props.isSubmitting}
          label={
            props.isSubmitting
              ? 'Creando…'
              : (props.submitLabel ?? 'Crear negocio')
          }
          onPress={props.onCreateOrganization}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  cash: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    width: 20,
  },
  createRoot: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 480,
    overflow: 'hidden',
  },
  createScroll: {
    padding: 16,
    paddingBottom: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  flex: {
    flex: 1,
  },
  footer: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    padding: 16,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: colors.slate,
    fontSize: 14,
  },
  scanModal: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionHint: {
    color: colors.slate,
    fontSize: 13,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionLabel: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
  },
  shortcutLabel: {
    color: colors.navy,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  shortcutLabelSelected: {
    fontWeight: '700',
  },
  shortcutList: {
    gap: 8,
    marginBottom: 8,
  },
  shortcutRow: {
    alignItems: 'center',
    borderColor: '#dfe7ec',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shortcutRowSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  signOut: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  signOutText: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '500',
  },
  spacer: {
    height: 10,
  },
  sucursalesBlock: {
    marginTop: 20,
  },
  toggleGroup: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  toggleGroupHint: {
    color: colors.slate,
    fontSize: 13,
    marginBottom: 8,
    marginTop: 2,
  },
  toggleGroupTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  toggleHint: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  toggleLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleLabels: {
    flex: 1,
    paddingRight: 12,
  },
  toggleRow: {
    alignItems: 'center',
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  verticalCheck: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  verticalContent: {
    flex: 1,
    paddingRight: 8,
  },
  verticalDescription: {
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  verticalList: {
    gap: 8,
    marginBottom: 8,
  },
  verticalRow: {
    alignItems: 'center',
    borderColor: '#dfe7ec',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  verticalRowSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  verticalTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  verticalTitleSelected: {
    fontWeight: '800',
  },
});
