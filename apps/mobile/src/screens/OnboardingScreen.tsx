import type { ReactElement } from 'react';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { Icon } from '../components/icons';
import {
  getNavShortcutOption,
  listNavShortcutOptions,
  type NavShortcutId,
} from '../lib/navShortcut';
import { parseStaffInviteToken } from '../lib/staffInviteToken';
import { colors } from '../theme';
import { styles as baseStyles } from '../styles';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

type OnboardingStep = 'choice' | 'create' | 'scan';

export function OnboardingScreen(props: {
  businessName: string;
  initialStep?: OnboardingStep;
  isSubmitting: boolean;
  navShortcut: NavShortcutId;
  onChangeBusinessName: (businessName: string) => void;
  onChangeNavShortcut: (navShortcut: NavShortcutId) => void;
  onCreateOrganization: () => void;
  onJoinWithInviteToken: (inviteToken: string) => void;
  onSignOut: () => void;
}): ReactElement {
  const [step, setStep] = useState<OnboardingStep>(props.initialStep ?? 'choice');
  const options = listNavShortcutOptions().filter((option) => !option.disabled);
  const selected = getNavShortcutOption(props.navShortcut);

  if (step === 'choice') {
    return (
      <View style={baseStyles.card}>
        <Text style={baseStyles.heading}>¿Cómo querés continuar?</Text>
        <Text style={baseStyles.bodyText}>
          Podés unirte a un negocio existente con el QR del dueño, o crear uno nuevo.
        </Text>

        <PrimaryButton label="Unirme con invitación (QR)" onPress={() => setStep('scan')} />
        <View style={styles.spacer} />
        <SecondaryButton label="Crear un negocio nuevo" onPress={() => setStep('create')} />

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
              // Navigate away; do not bounce back to the choice step first.
              props.onJoinWithInviteToken(token);
            }}
            title="Escanear invitación"
          />
        </SafeAreaView>
      </Modal>
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
            if (props.initialStep === 'create') {
              props.onSignOut();
              return;
            }
            setStep('choice');
          }}
          style={styles.backRow}
        >
          <Text style={styles.backText}>
            {props.initialStep === 'create' ? '‹ Cerrar sesión' : '‹ Volver'}
          </Text>
        </Pressable>

        <Text style={baseStyles.heading}>Creá tu negocio</Text>
        <Text style={baseStyles.bodyText}>
          Configurá el nombre y el atajo del menú inferior (a la derecha de Copi).
        </Text>
        <TextInput
          onChangeText={props.onChangeBusinessName}
          placeholder="Mi negocio"
          style={baseStyles.input}
          value={props.businessName}
        />

        <Text style={styles.sectionLabel}>Atajo del menú</Text>
        <Text style={styles.sectionHint}>
          Elegido: {selected.title}. Podés cambiarlo después en Configuración del negocio.
        </Text>
        <View style={styles.shortcutList}>
          {options.map((option) => {
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
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          disabled={props.isSubmitting}
          label={props.isSubmitting ? 'Creando…' : 'Crear negocio'}
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
  flex: {
    flex: 1,
  },
  footer: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    padding: 16,
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
  scanModal: {
    backgroundColor: colors.background,
    flex: 1,
  },
  spacer: {
    height: 10,
  },
});
