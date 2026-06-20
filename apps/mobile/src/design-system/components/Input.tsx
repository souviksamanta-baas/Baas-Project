import type { ReactElement } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { Icon } from '../../components/icons';
import { colors, radius, shadows, spacing, textStyles } from '../tokens';

type FieldProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

type TextFieldProps = FieldProps &
  TextInputProps & {
    error?: boolean;
    focused?: boolean;
  };

export function TextField(props: TextFieldProps): ReactElement {
  const { error, focused, label, style, ...inputProps } = props;

  return (
    <View style={[styles.field, style]}>
      <Text style={textStyles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          inputProps.multiline && styles.inputMultiline,
        ]}
        {...inputProps}
      />
    </View>
  );
}

type DisplayFieldProps = FieldProps & {
  calendar?: boolean;
  compactLabel?: boolean;
  highlight?: boolean;
  select?: boolean;
  textarea?: boolean;
  value: string;
};

/** Read-only field matching approved inventory form styling. */
export function DisplayField(props: DisplayFieldProps): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={[textStyles.fieldLabel, props.compactLabel && styles.labelCompact]}>{props.label}</Text>
      <View
        style={[
          styles.displayBox,
          props.highlight && styles.displayBoxHighlight,
          props.textarea && styles.displayBoxTextarea,
        ]}
      >
        <Text
          numberOfLines={props.textarea ? 3 : 1}
          style={[
            textStyles.fieldValue,
            props.highlight && styles.displayValueHighlight,
            props.textarea && styles.displayValueTextarea,
          ]}
        >
          {props.value}
        </Text>
        {props.select ? <Icon color={colors.slate} kind="chevron-down" size={10} strokeWidth={2} /> : null}
        {props.calendar ? <Icon color={colors.slate} kind="calendar" size={14} strokeWidth={1.8} /> : null}
      </View>
    </View>
  );
}

type SearchFieldProps = {
  placeholder?: string;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SearchField(props: SearchFieldProps): ReactElement {
  return (
    <View style={[styles.searchBox, props.shadow && shadows.card, props.style]}>
      <Icon color={colors.placeholder} kind="search" size={14} strokeWidth={1.8} />
      <Text style={styles.searchPlaceholder}>{props.placeholder ?? 'Buscar'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  displayBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 36,
    paddingHorizontal: 10,
  },
  displayBoxHighlight: {
    borderColor: colors.primary,
  },
  displayBoxTextarea: {
    alignItems: 'flex-start',
    height: 64,
    paddingVertical: spacing.xs,
  },
  displayValueHighlight: {
    color: colors.primary,
  },
  displayValueTextarea: {
    lineHeight: 14,
  },
  field: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inputError: {
    borderColor: colors.danger,
    color: colors.danger,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  labelCompact: {
    fontSize: 11,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 34,
    paddingHorizontal: 10,
  },
  searchPlaceholder: {
    color: colors.placeholder,
    flex: 1,
    fontSize: 10,
    fontWeight: '300',
  },
});
