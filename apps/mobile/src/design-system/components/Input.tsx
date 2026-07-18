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
const COMPOSER_FIELD_STYLE_ID = 'baas-composer-field-focus';

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

function ensureComposerFieldWebStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(COMPOSER_FIELD_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = COMPOSER_FIELD_STYLE_ID;
  style.textContent = `
    [data-composer-field-shell] {
      border: 1px solid ${colors.borderInput} !important;
      box-sizing: border-box;
      transition: border-color 0.15s ease;
    }
    [data-composer-field-shell]:focus-within {
      border-color: ${colors.primary} !important;
    }
    [data-composer-field-shell] input,
    [data-composer-field-shell] textarea {
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      background: transparent !important;
    }
    [data-composer-field-shell] input:focus,
    [data-composer-field-shell] input:focus-visible {
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
ensureComposerFieldWebStyles();

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
          Platform.OS === 'web' && styles.inputWeb,
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
  onChangeText?: (text: string) => void;
  onLeadingPress?: () => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  returnKeyType?: 'default' | 'send';
  style?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
  value?: string;
};

/** Copi composer — shell border matches SearchField green focus ring. */
export function ComposerInput(props: ComposerInputProps): ReactElement {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  function assignShellRef(node: View | null): void {
    if (Platform.OS === 'web' && node) {
      (node as unknown as HTMLElement).setAttribute('data-composer-field-shell', 'true');
    }
  }

  return (
    <View style={[styles.composerRow, props.style]}>
      {props.leadingIcon ? (
        <Pressable hitSlop={8} onPress={props.onLeadingPress} style={styles.composerLeadingPressable}>
          <Icon
            color={props.leadingIconColor ?? colors.primary}
            kind={props.leadingIcon}
            size={props.leadingIconSize ?? 18}
            strokeWidth={props.leadingIcon === 'search' ? 1.8 : 2.2}
          />
        </Pressable>
      ) : null}
      <View
        ref={assignShellRef}
        collapsable={false}
        style={[styles.composerShell, Platform.OS !== 'web' && focused && styles.composerShellFocused]}
      >
        <TextInput
          ref={inputRef}
          editable={props.editable ?? true}
          onBlur={() => setFocused(false)}
          onChangeText={props.onChangeText}
          onFocus={() => setFocused(true)}
          onSubmitEditing={props.onSubmitEditing}
          placeholder={props.placeholder}
          placeholderTextColor={colors.placeholder}
          returnKeyType={props.returnKeyType}
          style={[styles.composerInnerInput, composerInputWeb]}
          value={props.value}
        />
      </View>
      {props.trailing}
    </View>
  );
}

type SearchFieldProps = {
  onChangeText?: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  value?: string;
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
          onChangeText={props.onChangeText}
          onFocus={() => setFocused(true)}
          placeholder={props.placeholder ?? 'Buscar'}
          placeholderTextColor={colors.placeholder}
          style={[styles.searchFieldInput, searchInputWeb]}
          value={props.value}
        />
      </View>
    </View>
  );
}

type SearchActionRowProps = {
  onChangeText?: (text: string) => void;
  onPressFilter?: () => void;
  placeholder?: string;
  searchValue?: string;
  showCamera?: boolean;
  showFilter?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SearchActionRow(props: SearchActionRowProps): ReactElement {
  return (
    <View style={[styles.searchRow, props.style]}>
      <SearchField
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        style={styles.searchFieldFlex}
        value={props.searchValue}
      />
      {props.showCamera ? (
        <Pressable style={styles.searchIconButton}>
          <Icon color={colors.slate} kind="camera" size={18} strokeWidth={1.9} />
        </Pressable>
      ) : null}
      {props.showFilter ? (
        <Pressable onPress={props.onPressFilter} style={styles.searchIconButton}>
          <Icon color={colors.slate} kind="filter" size={17} strokeWidth={1.7} />
        </Pressable>
      ) : null}
    </View>
  );
}

const composerInputWeb: TextStyle =
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
  composerInnerInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12,
    fontWeight: '300',
    height: 36,
    margin: 0,
    padding: 0,
  },
  composerLeadingPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    height: 36,
    paddingHorizontal: spacing.md,
  },
  composerShellFocused: {
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
    alignSelf: 'stretch',
    gap: spacing.xs,
    width: '100%',
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
    paddingBottom: spacing.sm,
    textAlignVertical: 'top',
  },
  inputWeb: {
    outlineStyle: 'solid',
    outlineWidth: 0,
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
