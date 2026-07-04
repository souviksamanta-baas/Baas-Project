import { useState, type ReactElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MobileContainedModal } from './MobileContainedModal';
import { TextField } from '../design-system';
import { colors, radius } from '../theme';
import type { CatalogOption } from '../lib/productCatalog';
import { Icon } from './icons';

export function InventoryTextField(props: {
  full?: boolean;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  return (
    <TextField
      label={props.label}
      multiline={props.multiline}
      numberOfLines={props.multiline ? 4 : 1}
      onChangeText={props.onChangeText}
      style={[props.full ? styles.fieldFull : undefined, props.multiline && styles.multilineField]}
      value={props.value}
    />
  );
}

export function InventoryReadOnlyField(props: {
  full?: boolean;
  label: string;
  value: string;
}): ReactElement {
  return (
    <View style={[styles.field, props.full && styles.fieldFull]}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.readOnlyBox}>
        <Text style={styles.readOnlyValue}>{props.value}</Text>
      </View>
    </View>
  );
}

export function InventorySelectField<T extends string>(props: {
  disabled?: boolean;
  full?: boolean;
  highlight?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: CatalogOption<T>[];
  value: T;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    props.options.find((option) => option.value === props.value)?.label ?? props.value;

  return (
    <>
      <View style={[styles.field, props.full && styles.fieldFull]}>
        <Text style={styles.label}>{props.label}</Text>
        <Pressable
          disabled={props.disabled}
          onPress={() => setOpen(true)}
          style={[
            styles.selectBox,
            props.highlight && styles.selectBoxHighlight,
            props.disabled && styles.selectBoxDisabled,
          ]}
        >
          <Text
            style={[
              styles.selectValue,
              props.highlight && styles.selectValueHighlight,
              props.disabled && styles.selectValueDisabled,
            ]}
          >
            {selectedLabel}
          </Text>
          {!props.disabled ? <Icon color={colors.slate} kind="chevron-down" size={10} strokeWidth={2} /> : null}
        </Pressable>
      </View>

      <MobileContainedModal onClose={() => setOpen(false)} visible={open}>
        <Text style={styles.modalTitle}>{props.label}</Text>
        {props.options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              props.onChange(option.value);
              setOpen(false);
            }}
            style={[styles.modalOption, option.value === props.value && styles.modalOptionActive]}
          >
            <Text
              style={[
                styles.modalOptionText,
                option.value === props.value && styles.modalOptionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </MobileContainedModal>
    </>
  );
}

export function InventoryMoneyField(props: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <Text style={styles.prefixText}>$</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={props.onChangeText}
          placeholder="0.00"
          placeholderTextColor={colors.placeholder}
          style={[styles.prefixInput, Platform.OS === 'web' && styles.inputWeb]}
          value={props.value}
        />
      </View>
    </View>
  );
}

export function InventoryPercentField(props: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={props.onChangeText}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          style={[styles.suffixInput, Platform.OS === 'web' && styles.inputWeb]}
          value={props.value}
        />
        <Text style={styles.suffixText}>%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    minWidth: 0,
  },
  fieldFull: {
    flexBasis: '100%',
    width: '100%',
  },
  inputWeb: {
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  label: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalOption: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOptionActive: {
    backgroundColor: '#eef8f3',
    borderColor: colors.primary,
  },
  modalOptionText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '500',
  },
  modalOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  multilineField: {
    marginBottom: 4,
  },
  prefixInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    minWidth: 0,
    paddingVertical: 0,
  },
  prefixInputBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  prefixText: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyBox: {
    backgroundColor: '#f4f7f8',
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  readOnlyValue: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '500',
  },
  selectBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  selectBoxDisabled: {
    backgroundColor: '#f4f7f8',
  },
  selectBoxHighlight: {
    backgroundColor: '#eef8f3',
    borderColor: colors.primary,
  },
  selectValue: {
    color: colors.navy,
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  selectValueDisabled: {
    color: colors.slate,
  },
  selectValueHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  suffixInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    minWidth: 0,
    paddingVertical: 0,
    textAlign: 'right',
  },
  suffixText: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
  },
});
