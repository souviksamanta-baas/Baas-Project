import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { Icon } from '../components/icons';
import {
  getNavShortcutOption,
  listNavShortcutOptions,
  type NavShortcutId,
} from '../lib/navShortcut';
import { colors } from '../theme';
import { styles as baseStyles } from '../styles';

export function OnboardingScreen(props: {
  businessName: string;
  isSubmitting: boolean;
  navShortcut: NavShortcutId;
  onChangeBusinessName: (businessName: string) => void;
  onChangeNavShortcut: (navShortcut: NavShortcutId) => void;
  onCreateOrganization: () => void;
}): ReactElement {
  const options = listNavShortcutOptions().filter((option) => !option.disabled);
  const selected = getNavShortcutOption(props.navShortcut);

  return (
    <View style={baseStyles.card}>
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

      <PrimaryButton
        disabled={props.isSubmitting}
        label={props.isSubmitting ? 'Creando…' : 'Crear negocio'}
        onPress={props.onCreateOrganization}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cash: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
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
    marginBottom: 16,
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
});
