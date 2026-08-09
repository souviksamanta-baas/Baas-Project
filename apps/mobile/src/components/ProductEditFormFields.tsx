import { useMemo, useState, type ReactElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MobileContainedModal } from './MobileContainedModal';
import { TextField } from '../design-system';
import { colors, radius } from '../theme';
import { formatDateInput, parseDateInput } from '../lib/addStockForm';
import { filterSupplierSuggestions } from '../lib/productCatalog';
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
    <View style={[styles.field, props.full && styles.fieldFull, props.multiline && styles.multilineField]}>
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

export function InventorySupplierField(props: {
  existingOnly?: boolean;
  full?: boolean;
  label: string;
  onChangeText: (value: string) => void;
  suggestions: string[];
  value: string;
}): ReactElement {
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => {
    if (!focused) {
      return [];
    }

    const filtered = filterSupplierSuggestions(props.suggestions, props.value);

    if (filtered.length > 0 || props.value.trim().length > 0) {
      return filtered;
    }

    return props.existingOnly ? props.suggestions.slice(0, 8) : [];
  }, [focused, props.existingOnly, props.suggestions, props.value]);

  return (
    <View style={[styles.field, props.full && styles.fieldFull]}>
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
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => props.onChangeText(value.replace(/[^\d]/g, ''))}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          style={[styles.prefixInput, Platform.OS === 'web' && styles.inputWeb]}
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
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.prefixInputBox}>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={props.onChangeText}
          placeholder={props.placeholder ?? '0'}
          placeholderTextColor={colors.placeholder}
          style={[styles.prefixInput, Platform.OS === 'web' && styles.inputWeb]}
          value={props.value}
        />
      </View>
    </View>
  );
}

export function InventoryDateField(props: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}): ReactElement {
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedDate = parseDateInput(props.value) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

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
    setPickerOpen(true);
  }

  function selectDay(day: number): void {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    props.onChange(formatDateInput(next));
    setPickerOpen(false);
  }

  const monthLabel = visibleMonth.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
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
  const calendarCells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const selectedDay =
    parseDateInput(props.value) &&
    parseDateInput(props.value)!.getFullYear() === visibleMonth.getFullYear() &&
    parseDateInput(props.value)!.getMonth() === visibleMonth.getMonth()
      ? parseDateInput(props.value)!.getDate()
      : null;
  const isoValue = parseDateInput(props.value)
    ? `${parseDateInput(props.value)!.getFullYear()}-${String(parseDateInput(props.value)!.getMonth() + 1).padStart(2, '0')}-${String(parseDateInput(props.value)!.getDate()).padStart(2, '0')}`
    : '';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
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
        <Text style={styles.modalTitle}>{props.label}</Text>
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
          <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
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
      </MobileContainedModal>
    </View>
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
    marginTop: 4,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarMonthLabel: {
    color: colors.navy,
    flex: 1,
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
});
