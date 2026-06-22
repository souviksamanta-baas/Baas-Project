import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { IconKind } from '../../components/icons';
import { Icon } from '../../components/icons';
import { colors, radius, spacing, textStyles } from '../tokens';

const SEARCH_FIELD_STYLE_ID = 'baas-search-field-focus';

function ensureSearchFieldWebStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(SEARCH_FIELD_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SEARCH_FIELD_STYLE_ID;
  style.textContent = `
    [data-search-field-shell] {
      border: 1px solid ${colors.borderInput} !important;
      box-sizing: border-box;
      transition: border-color 0.15s ease;
    }
    [data-search-field-shell]:focus-within {
      border-color: ${colors.primary} !important;
    }
    [data-search-field-shell] input,
    [data-search-field-shell] textarea {
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      background: transparent !important;
    }
    [data-search-field-shell] input:focus,
    [data-search-field-shell] input:focus-visible {
      border: none !important;
      outline: none !important;
      outline-width: 0 !important;
      outline-color: transparent !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
}

ensureSearchFieldWebStyles();

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

type ComposerInputProps = {
  editable?: boolean;
  leadingIcon?: IconKind;
  leadingIconColor?: string;
  leadingIconSize?: number;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
};

/** Copi composer — icon outside; border and focus ring on the TextInput itself. */
export function ComposerInput(props: ComposerInputProps): ReactElement {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.composerRow, props.style]}>
      {props.leadingIcon ? (
        <Icon
          color={props.leadingIconColor ?? colors.primary}
          kind={props.leadingIcon}
          size={props.leadingIconSize ?? 18}
          strokeWidth={props.leadingIcon === 'search' ? 1.8 : 2.2}
        />
      ) : null}
      <TextInput
        editable={props.editable ?? true}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        placeholder={props.placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.composerInput, focused && styles.composerInputFocused, composerInputWeb]}
      />
      {props.trailing}
    </View>
  );
}

type SearchFieldProps = {
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Search field used on Inbox, Gestionar stock, and Ventas.
 *
 * Focus styling:
 * - Border on the parent shell (`searchFieldShell`) wrapping icon + input.
 * - Focused: `colors.primary` (#08bd66) on the full shell, not on the TextInput.
 * - Native: `searchFieldShellFocused` via onFocus/onBlur.
 * - Web: `[data-search-field-shell]:focus-within` + no inner input border/outline.
 *
 * @see docs/mobile-design-system.md
 */
export function SearchField(props: SearchFieldProps): ReactElement {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  function assignShellRef(node: View | null): void {
    if (Platform.OS === 'web' && node) {
      (node as unknown as HTMLElement).setAttribute('data-search-field-shell', 'true');
    }
  }

  function focusInput(): void {
    inputRef.current?.focus();
  }

  return (
    <View style={[styles.searchFieldOuter, props.style]}>
      <View
        ref={assignShellRef}
        collapsable={false}
        style={[
          styles.searchFieldShell,
          Platform.OS !== 'web' && focused && styles.searchFieldShellFocused,
        ]}
      >
        <Pressable hitSlop={8} onPress={focusInput} style={styles.searchFieldIconPressable}>
          <Icon color={colors.placeholder} kind="search" size={14} strokeWidth={1.8} />
        </Pressable>
        <TextInput
          ref={inputRef}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          placeholder={props.placeholder ?? 'Buscar'}
          placeholderTextColor={colors.placeholder}
          style={[styles.searchFieldInput, searchInputWeb]}
        />
      </View>
    </View>
  );
}

type SearchActionRowProps = {
  placeholder?: string;
  showCamera?: boolean;
  showFilter?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SearchActionRow(props: SearchActionRowProps): ReactElement {
  return (
    <View style={[styles.searchRow, props.style]}>
      <SearchField placeholder={props.placeholder} style={styles.searchFieldFlex} />
      {props.showCamera ? (
        <Pressable style={styles.searchIconButton}>
          <Icon color={colors.slate} kind="camera" size={18} strokeWidth={1.9} />
        </Pressable>
      ) : null}
      {props.showFilter ? (
        <Pressable style={styles.searchIconButton}>
          <Icon color={colors.slate} kind="filter" size={17} strokeWidth={1.7} />
        </Pressable>
      ) : null}
    </View>
  );
}

const composerInputWeb: TextStyle = Platform.OS === 'web' ? ({ outlineWidth: 0 } as TextStyle) : {};
const searchInputWeb: TextStyle =
  Platform.OS === 'web'
    ? ({
        borderWidth: 0,
        borderColor: 'transparent',
        boxShadow: 'none',
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
      } as unknown as TextStyle)
    : { borderWidth: 0 };

const styles = StyleSheet.create({
  composerInput: {
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12,
    fontWeight: '300',
    height: 36,
    paddingHorizontal: spacing.md,
  },
  composerInputFocused: {
    borderColor: colors.primary,
  },
  composerRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
  searchFieldFlex: {
    flex: 1,
  },
  searchFieldOuter: {
    flex: 1,
  },
  searchFieldIconPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFieldInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12,
    fontWeight: '300',
    height: '100%',
    margin: 0,
    padding: 0,
  },
  searchFieldShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 36,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  searchFieldShellFocused: {
    borderColor: colors.primary,
  },
  searchIconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 9,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 38,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
