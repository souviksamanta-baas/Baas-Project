import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export type MultiSucursalesChoice = 'yes' | 'no';

/**
 * Shared Sí/No control for “¿Tenés más de una sucursal?”.
 * Currently shown deactivated with default “No” until multi-sucursal UX ships.
 */
export function MultiSucursalesQuestion(props: {
  disabled?: boolean;
  onChange?: (value: MultiSucursalesChoice) => void;
  value: MultiSucursalesChoice;
}): ReactElement {
  const disabled = props.disabled ?? true;

  return (
    <View style={[styles.wrap, disabled && styles.wrapDisabled]}>
      <Text style={styles.label}>¿Tenés más de una sucursal?</Text>
      <Text style={styles.hint}>
        Si elegís No, no mostramos el campo Sucursal en productos. Por ahora queda en No.
      </Text>
      <View style={styles.row}>
        {(
          [
            { label: 'Sí', value: 'yes' as const },
            { label: 'No', value: 'no' as const },
          ] as const
        ).map((option) => {
          const active = props.value === option.value;
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => props.onChange?.(option.value)}
              style={[
                styles.chip,
                active && styles.chipActive,
                disabled && styles.chipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextActive,
                  disabled && styles.chipTextDisabled,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: '#eef8f3',
    borderColor: colors.primary,
  },
  chipDisabled: {
    opacity: 0.85,
  },
  chipText: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  chipTextDisabled: {
    opacity: 0.9,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  wrap: {
    gap: 8,
  },
  wrapDisabled: {
    opacity: 0.92,
  },
});
