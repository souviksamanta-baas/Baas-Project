import { useMemo, useState, type ReactElement } from 'react';
import {
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { MobileContainedModal } from './MobileContainedModal';
import { TextField } from '../design-system';
import { colors, radius } from '../theme';
import { formatDateInput, parseDateInput } from '../lib/addStockForm';
import { filterSupplierSuggestions } from '../lib/productCatalog';
import type { CatalogOption } from '../lib/productCatalog';
import {
  responsiveFieldMinWidth,
  responsiveInputFontSize,
} from '../lib/responsiveFieldWidth';
import { Icon } from './icons';

const INPUT_CHROME = 36;
const MONEY_CHROME = 54;
const PERCENT_CHROME = 52;
const DATE_CHROME = 70;

function useResponsiveField(text: string, chrome: number, label?: string): {
  fieldStyle: { flexBasis: number; minWidth: number };
  fontSize: number;
} {
  const { width } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();
  const maxWidth = Math.max(120, width - 76);
  const minWidth = responsiveFieldMinWidth({ chrome, fontScale, label, maxWidth, text });

  return {
    fieldStyle: { flexBasis: minWidth, minWidth },
    fontSize: responsiveInputFontSize({ chrome, fontScale, maxWidth, text }),
  };
}

export function InventoryTextField(props: {
  full?: boolean;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  const layout = useResponsiveField(props.value, INPUT_CHROME, props.label);

  return (
    <View
      style={[
        styles.field,
        layout.fieldStyle,
        props.full && styles.fieldFull,
        props.multiline && styles.multilineField,
      ]}
    >
      <TextField
        label={props.label}
        multiline={props.multiline}
        numberOfLines={props.multiline ? 4 : 1}
        onChangeText={props.onChangeText}
        value={props.value}
      />
    </View>
  );
}

function normalizeCategoryList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function InventoryCategoryChipField(props: {
  full?: boolean;
  label?: string;
  onChange: (values: string[]) => void;
  suggestions: string[];
  value: string[];
}): ReactElement {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const label = props.label ?? 'Categorías';

  const selected = useMemo(() => normalizeCategoryList(props.value), [props.value]);
  const selectedKeys = useMemo(
    () => new Set(selected.map((entry) => entry.toLowerCase())),
    [selected],
  );

  const suggestions = useMemo(() => {
    const normalizedDraft = draft.trim().toLowerCase();
    if (!focused || normalizedDraft.length === 0) {
      return [];
    }

    return props.suggestions
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .filter((entry) => !selectedKeys.has(entry.toLowerCase()))
      .filter((entry) => entry.toLowerCase().includes(normalizedDraft))
      .slice(0, 8);
  }, [draft, focused, props.suggestions, selectedKeys]);

  function commit(next: string[]): void {
    props.onChange(normalizeCategoryList(next));
  }

  function addCategory(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedKeys.has(trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    commit([...selected, trimmed]);
    setDraft('');
  }

  function removeCategory(name: string): void {
    commit(selected.filter((entry) => entry.toLowerCase() !== name.toLowerCase()));
  }

  const exactMatch = suggestions.some(
    (entry) => entry.toLowerCase() === draft.trim().toLowerCase(),
  );
  const canCreateNew = draft.trim().length > 0 && !exactMatch && !selectedKeys.has(draft.trim().toLowerCase());

  return (
    <View style={[styles.field, props.full && styles.fieldFull]}>
      <Text style={styles.label}>{label}</Text>
      {selected.length > 0 ? (
        <View style={styles.chipRow}>
          {selected.map((entry) => (
            <View key={entry} style={styles.categoryChip}>
              <Text style={styles.categoryChipLabel}>{entry}</Text>
              <Pressable
                accessibilityLabel={`Quitar ${entry}`}
                hitSlop={8}
                onPress={() => removeCategory(entry)}
                style={styles.categoryChipRemove}
              >
                <Text style={styles.categoryChipRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.categoryInputBox}>
        <TextInput
          onBlur={() => {
            setTimeout(() => setFocused(false), 120);
          }}
          onChangeText={setDraft}
          onFocus={() => setFocused(true)}
          onSubmitEditing={() => addCategory(draft)}
          placeholder="Buscar o crear categoría"
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          style={[styles.categoryInput, Platform.OS === 'web' && styles.inputWeb]}
          value={draft}
        />
        {canCreateNew ? (
          <Pressable
            accessibilityLabel="Agregar categoría"
            hitSlop={8}
            onPress={() => addCategory(draft)}
            style={styles.categoryInputAction}
          >
            <Icon color={colors.primary} kind="plus" size={12} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
      {suggestions.length > 0 ? (
        <View style={styles.suggestionList}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => addCategory(suggestion)}
              style={styles.suggestionItem}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {canCreateNew ? (
        <Pressable
          onPress={() => addCategory(draft)}
          style={styles.createCategoryHint}
        >
          <Icon color={colors.primary} kind="plus" size={11} strokeWidth={2.4} />
          <Text style={styles.createCategoryHintText}>Crear «{draft.trim()}»</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InventoryReadOnlyField(props: {
  full?: boolean;
  label: string;
  value: string;
}): ReactElement {
  const layout = useResponsiveField(props.value, INPUT_CHROME, props.label);

  return (
    <View style={[styles.field, layout.fieldStyle, props.full && styles.fieldFull]}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.readOnlyBox}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          style={styles.readOnlyValue}
        >
          {props.value}
        </Text>
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
  const layout = useResponsiveField(selectedLabel, INPUT_CHROME, props.label);

  return (
    <>
      <View style={[styles.field, layout.fieldStyle, props.full && styles.fieldFull]}>
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
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
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

export function InventorySupplierField(props: {
  existingOnly?: boolean;
  full?: boolean;
  label: string;
  onChangeText: (value: string) => void;
  suggestions: string[];
  value: string;
}): ReactElement {
  const [focused, setFocused] = useState(false);
  const layout = useResponsiveField(
    props.value.trim() || (props.existingOnly ? 'Buscar' : 'Proveedor'),
    INPUT_CHROME,
    props.label,
  );
  const matches = useMemo(() => {
    if (!focused || props.value.trim().length === 0) {
      return [];
    }

    return filterSupplierSuggestions(props.suggestions, props.value);
  }, [focused, props.suggestions, props.value]);

  return (
    <View style={[styles.field, layout.fieldStyle, props.full && styles.fieldFull]}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        onBlur={() => {
          setTimeout(() => {
            setFocused(false);

            if (!props.existingOnly) {
              return;
            }

            const trimmed = props.value.trim();

            if (!trimmed) {
              return;
            }

            const exact = props.suggestions.find(
              (supplier) => supplier.toLowerCase() === trimmed.toLowerCase(),
            );

            if (exact) {
              if (exact !== props.value) {
                props.onChangeText(exact);
              }

              return;
            }

            props.onChangeText('');
          }, 120);
        }}
        onChangeText={props.onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={props.existingOnly ? 'Buscar proveedor' : 'Nombre del proveedor'}
        placeholderTextColor={colors.placeholder}
        style={[styles.supplierInput, Platform.OS === 'web' && styles.inputWeb]}
        value={props.value}
      />
      {matches.length > 0 ? (
        <View style={styles.suggestionList}>
          {matches.map((supplier, index) => (
            <Pressable
              key={`${supplier}-${index}`}
              onPress={() => {
                props.onChangeText(supplier);
                setFocused(false);
              }}
              style={styles.suggestionItem}
            >
              <Text style={styles.suggestionText}>{supplier}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function InventoryIntegerField(props: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  const sample = props.value.trim() || '0';
  const layout = useResponsiveField(sample, INPUT_CHROME, props.label);

  return (
    <View style={[styles.field, layout.fieldStyle]}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => props.onChangeText(value.replace(/[^\d]/g, ''))}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          style={[
            styles.prefixInput,
            { fontSize: layout.fontSize },
            Platform.OS === 'web' && styles.inputWeb,
          ]}
          value={props.value}
        />
      </View>
    </View>
  );
}

export function InventoryDecimalField(props: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}): ReactElement {
  const sample = props.value.trim() || props.placeholder || '0';
  const layout = useResponsiveField(sample, INPUT_CHROME, props.label);

  return (
    <View style={[styles.field, layout.fieldStyle]}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={props.onChangeText}
          placeholder={props.placeholder ?? '0'}
          placeholderTextColor={colors.placeholder}
          style={[
            styles.prefixInput,
            { fontSize: layout.fontSize },
            Platform.OS === 'web' && styles.inputWeb,
          ]}
          value={props.value}
        />
      </View>
    </View>
  );
}

export function InventoryDateField(props: {
  label?: string;
  onChange: (value: string) => void;
  value: string;
}): ReactElement {
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'days' | 'months' | 'years'>('days');
  const selectedDate = parseDateInput(props.value) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const label = props.label?.trim() ?? '';
  const dateSample = props.value.trim().length >= 10 ? props.value.trim() : '00/00/0000';
  const layout = useResponsiveField(dateSample, DATE_CHROME, label);

  function applyIsoDate(isoValue: string): void {
    const date = new Date(`${isoValue}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    props.onChange(formatDateInput(date));
  }

  function openPicker(): void {
    const current = parseDateInput(props.value) ?? new Date();
    setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setPickerMode('days');
    setPickerOpen(true);
  }

  function selectDay(day: number): void {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    props.onChange(formatDateInput(next));
    setPickerOpen(false);
  }

  const monthName = visibleMonth.toLocaleDateString('es-AR', { month: 'long' });
  const yearLabel = String(visibleMonth.getFullYear());
  const firstWeekday = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const leadingBlanks = (firstWeekday + 6) % 7; // Monday-first
  // Always 6 weeks so modal height does not jump between months.
  const calendarCells = [
    ...Array.from({ length: leadingBlanks }, () => null as number | null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ...Array.from({ length: Math.max(0, 42 - leadingBlanks - daysInMonth) }, () => null),
  ];
  const parsed = parseDateInput(props.value);
  const selectedDay =
    parsed &&
    parsed.getFullYear() === visibleMonth.getFullYear() &&
    parsed.getMonth() === visibleMonth.getMonth()
      ? parsed.getDate()
      : null;
  const isoValue = parsed
    ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    : '';
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
  const monthOptions = Array.from({ length: 12 }, (_, index) => index);

  return (
    <View style={[styles.field, layout.fieldStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.dateInputBox}>
        <TextInput
          keyboardType="numbers-and-punctuation"
          onBlur={() => setFocused(false)}
          onChangeText={props.onChange}
          onFocus={() => setFocused(true)}
          placeholder="dia/mes/año"
          placeholderTextColor={colors.placeholder}
          style={[
            styles.dateInput,
            { fontSize: layout.fontSize },
            Platform.OS === 'web' && styles.inputWeb,
            !props.value && !focused && styles.dateInputPlaceholder,
          ]}
          value={props.value}
        />
        {Platform.OS === 'web' ? (
          <label style={styles.webDateLabel}>
            <Icon color={colors.slate} kind="calendar" size={16} strokeWidth={1.8} />
            <input
              onChange={(event) => applyIsoDate(event.currentTarget.value)}
              style={styles.webDateInput}
              type="date"
              value={isoValue}
            />
          </label>
        ) : (
          <Pressable
            accessibilityLabel="Abrir calendario"
            hitSlop={10}
            onPress={openPicker}
            style={styles.calendarButton}
          >
            <Icon color={colors.slate} kind="calendar" size={16} strokeWidth={1.8} />
          </Pressable>
        )}
      </View>

      <MobileContainedModal onClose={() => setPickerOpen(false)} visible={pickerOpen}>
        <Text style={styles.modalTitle}>{label || 'Fecha'}</Text>
        <View style={styles.calendarHeader}>
          <Pressable
            accessibilityLabel="Mes anterior"
            hitSlop={8}
            onPress={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
            style={styles.calendarNavButton}
          >
            <Icon color={colors.navy} kind="arrow-left" size={16} strokeWidth={2} />
          </Pressable>
          <View style={styles.calendarHeaderLabels}>
            <Pressable
              accessibilityLabel="Elegir mes"
              onPress={() => setPickerMode((mode) => (mode === 'months' ? 'days' : 'months'))}
              style={styles.calendarHeaderChip}
            >
              <Text style={styles.calendarMonthLabel}>{monthName}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Elegir año"
              onPress={() => setPickerMode((mode) => (mode === 'years' ? 'days' : 'years'))}
              style={styles.calendarHeaderChip}
            >
              <Text style={styles.calendarMonthLabel}>{yearLabel}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel="Mes siguiente"
            hitSlop={8}
            onPress={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
            style={styles.calendarNavButton}
          >
            <Icon color={colors.navy} kind="chevron-right" size={16} strokeWidth={2} />
          </Pressable>
        </View>
        {pickerMode === 'months' ? (
          <View style={styles.calendarPickerGrid}>
            {monthOptions.map((monthIndex) => {
              const name = new Date(2000, monthIndex, 1).toLocaleDateString('es-AR', {
                month: 'short',
              });
              const selected = visibleMonth.getMonth() === monthIndex;
              return (
                <Pressable
                  key={monthIndex}
                  onPress={() => {
                    setVisibleMonth(
                      (current) => new Date(current.getFullYear(), monthIndex, 1),
                    );
                    setPickerMode('days');
                  }}
                  style={[styles.calendarPickerCell, selected && styles.calendarDayCellSelected]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      selected && styles.calendarDayTextSelected,
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {pickerMode === 'years' ? (
          <View style={styles.calendarPickerGrid}>
            {yearOptions.map((year) => {
              const selected = visibleMonth.getFullYear() === year;
              return (
                <Pressable
                  key={year}
                  onPress={() => {
                    setVisibleMonth((current) => new Date(year, current.getMonth(), 1));
                    setPickerMode('days');
                  }}
                  style={[styles.calendarPickerCell, selected && styles.calendarDayCellSelected]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      selected && styles.calendarDayTextSelected,
                    ]}
                  >
                    {year}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {pickerMode === 'days' ? (
          <>
            <View style={styles.calendarWeekdays}>
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                <Text key={day} style={styles.calendarWeekday}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarCells.map((day, index) =>
                day == null ? (
                  <View key={`blank-${index}`} style={styles.calendarDayCell} />
                ) : (
                  <Pressable
                    key={`day-${day}`}
                    onPress={() => selectDay(day)}
                    style={[
                      styles.calendarDayCell,
                      selectedDay === day && styles.calendarDayCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        selectedDay === day && styles.calendarDayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          </>
        ) : null}
      </MobileContainedModal>
    </View>
  );
}

export function InventoryMoneyField(props: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  const sample = props.value.trim() || '0.00';
  const layout = useResponsiveField(sample, MONEY_CHROME, props.label);

  return (
    <View style={[styles.field, layout.fieldStyle]}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <Text style={styles.prefixText}>$</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={props.onChangeText}
          placeholder="0.00"
          placeholderTextColor={colors.placeholder}
          style={[
            styles.prefixInput,
            { fontSize: layout.fontSize },
            Platform.OS === 'web' && styles.inputWeb,
          ]}
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
  const sample = props.value.trim() || '0';
  const layout = useResponsiveField(sample, PERCENT_CHROME, props.label);

  return (
    <View style={[styles.field, layout.fieldStyle]}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={props.onChangeText}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          style={[
            styles.suffixInput,
            { fontSize: layout.fontSize },
            Platform.OS === 'web' && styles.inputWeb,
          ]}
          value={props.value}
        />
        <Text style={styles.suffixText}>%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  calendarDayCell: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: '14.28%',
  },
  calendarDayCellSelected: {
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
  },
  calendarDayText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 216,
    marginTop: 4,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarHeaderChip: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  calendarHeaderLabels: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  calendarNavButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  calendarPickerCell: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginBottom: 8,
    width: '33.33%',
  },
  calendarPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 216,
  },
  calendarWeekday: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '14.28%',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dateInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minWidth: 0,
    paddingVertical: 0,
  },
  dateInputBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  dateInputPlaceholder: {
    fontWeight: '300',
  },
  field: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: '100%',
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
    fontSize: 13,
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
    fontSize: 15,
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
    fontSize: 15,
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
    fontSize: 15,
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
    fontSize: 15,
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
    fontSize: 15,
    fontWeight: '500',
    minWidth: 0,
    paddingVertical: 0,
    textAlign: 'right',
  },
  suffixText: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '600',
  },
  suggestionItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  suggestionList: {
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestionText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
  },
  supplierInput: {
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  webDateInput: {
    cursor: 'pointer',
    height: 28,
    opacity: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 28,
  },
  webDateLabel: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    width: 28,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryChipLabel: {
    color: colors.primary,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipRemove: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  categoryChipRemoveText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
  },
  categoryInputBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  categoryInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minWidth: 0,
    paddingVertical: 10,
  },
  categoryInputAction: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  createCategoryHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  createCategoryHintText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
