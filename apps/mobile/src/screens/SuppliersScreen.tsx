import { useFocusEffect } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ContactPickerModal } from '../components/ContactPickerModal';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, TextField } from '../design-system';
import {
  addSupplier,
  listSuppliers,
  removeSupplier,
  supplierInitials,
  type SupplierContact,
} from '../lib/suppliers';
import { colors } from '../theme';

function sectionLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  const normalized = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /[A-Z]/i.test(normalized) ? normalized : '#';
}

export function SuppliersScreen(props: { onBack: () => void }): ReactElement {
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setSuppliers(await listSuppliers());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SupplierContact[]>();

    for (const supplier of suppliers) {
      const letter = sectionLetter(supplier.name);
      const bucket = map.get(letter) ?? [];
      bucket.push(supplier);
      map.set(letter, bucket);
    }

    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right, 'es'));
  }, [suppliers]);

  async function handleAddManual(): Promise<void> {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await addSupplier({ name, notes, phone });
      setName('');
      setPhone('');
      setNotes('');
      setShowManualForm(false);
      setSuppliers(await listSuppliers());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setIsSaving(false);
    }
  }

  function confirmRemove(supplier: SupplierContact): void {
    Alert.alert('Eliminar proveedor', `¿Querés quitar a ${supplier.name} de la lista?`, [
      { style: 'cancel', text: 'Cancelar' },
      {
        style: 'destructive',
        text: 'Eliminar',
        onPress: () => {
          void removeSupplier(supplier.id).then(async () => {
            setSuppliers(await listSuppliers());
          });
        },
      },
    ]);
  }

  return (
    <ScreenContent title="Proveedores">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle subtitle="Agenda de contactos de abastecimiento" title="Proveedores" />
        </View>
      </View>

      <Card style={styles.formCard}>
        <Pressable
          onPress={() => {
            setErrorMessage(null);
            setContactPickerOpen(true);
          }}
          style={styles.contactLink}
        >
          <Text style={styles.contactLinkText}>+ Agregar desde contactos</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowManualForm((current) => !current)}
          style={styles.contactLink}
        >
          <Text style={styles.contactLinkText}>
            {showManualForm ? 'Cerrar alta manual' : '+ Agregar manualmente'}
          </Text>
        </Pressable>

        {showManualForm ? (
          <>
            <TextField
              label="Nombre *"
              onChangeText={setName}
              placeholder="Nombre del proveedor"
              value={name}
            />
            <TextField
              keyboardType="phone-pad"
              label="Teléfono"
              onChangeText={setPhone}
              placeholder="0351…"
              value={phone}
            />
            <TextField
              label="Notas"
              onChangeText={setNotes}
              placeholder="Qué vende, días de entrega…"
              value={notes}
            />
            <PrimaryButton
              disabled={isSaving}
              fullWidth
              label={isSaving ? 'Guardando…' : 'Guardar proveedor'}
              onPress={() => void handleAddManual()}
            />
          </>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Card>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {!isLoading && suppliers.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            Todavía no tenés proveedores. Agregá uno desde la agenda del teléfono o crealo a mano.
          </Text>
        </Card>
      ) : null}

      {!isLoading && grouped.length > 0 ? (
        <Card flush style={styles.listCard}>
          {grouped.map(([letter, items]) => (
            <View key={letter}>
              <Text style={styles.sectionHeader}>{letter}</Text>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  onLongPress={() => confirmRemove(item)}
                  style={styles.contactRow}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{supplierInitials(item.name)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactMeta}>
                      {item.phone?.trim() || item.phoneE164 || 'Sin teléfono'}
                    </Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => confirmRemove(item)}>
                    <Text style={styles.deleteText}>Eliminar</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ))}
        </Card>
      ) : null}

      <ContactPickerModal
        onClose={() => setContactPickerOpen(false)}
        onSelect={(contact) => {
          setContactPickerOpen(false);
          setErrorMessage(null);
          void addSupplier({
            name: contact.displayName,
            phone: contact.rawPhone,
            phoneE164: contact.phoneE164,
          })
            .then(async () => {
              setSuppliers(await listSuppliers());
            })
            .catch((error: unknown) => {
              setErrorMessage(
                error instanceof Error ? error.message : 'No se pudo guardar el contacto.',
              );
            });
        }}
        visible={contactPickerOpen}
      />
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  backPressable: {
    marginLeft: -6,
    marginTop: -4,
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    width: 28,
  },
  contactLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  contactLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  contactMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  contactName: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  contactRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  flex: {
    flex: 1,
  },
  formCard: {
    gap: 14,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 4,
  },
  listCard: {
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: colors.surfaceMint,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
