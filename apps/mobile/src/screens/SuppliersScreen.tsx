import { useFocusEffect } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import {
  listSuppliers,
  removeSupplier,
  supplierInitials,
  supplierLabel,
  type SupplierContact,
} from '../lib/suppliers';
import { colors } from '../theme';

function sectionLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  const normalized = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /[A-Z]/i.test(normalized) ? normalized : '#';
}

export function SuppliersScreen(props: {
  onAddSupplier: () => void;
  onBack: () => void;
}): ReactElement {
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const letter = sectionLetter(supplierLabel(supplier));
      const bucket = map.get(letter) ?? [];
      bucket.push(supplier);
      map.set(letter, bucket);
    }

    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right, 'es'));
  }, [suppliers]);

  function confirmRemove(supplier: SupplierContact): void {
    const label = supplierLabel(supplier);
    Alert.alert('Eliminar proveedor', `¿Querés quitar a ${label} de la lista?`, [
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
          <ScreenTitle onBack={props.onBack} title="Proveedores" />
        </View>
      </View>

      <Pressable onPress={props.onAddSupplier} style={styles.addLink}>
        <Text style={styles.addLinkText}>+ Agregar proveedores</Text>
      </Pressable>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {!isLoading && suppliers.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            Todavía no tenés proveedores. Agregá uno con + Agregar proveedores.
          </Text>
        </Card>
      ) : null}

      {!isLoading && grouped.length > 0 ? (
        <Card flush style={styles.listCard}>
          {grouped.map(([letter, items]) => (
            <View key={letter}>
              <Text style={styles.sectionHeader}>{letter}</Text>
              {items.map((item) => {
                const label = supplierLabel(item);
                const secondaryParts = [item.name.trim(), item.phone?.trim() || item.phoneE164]
                  .filter((part): part is string => Boolean(part && part.length > 0));

                return (
                  <Pressable
                    key={item.id}
                    onLongPress={() => confirmRemove(item)}
                    style={styles.contactRow}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{supplierInitials(label)}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.contactName}>{label}</Text>
                      <Text style={styles.contactMeta}>
                        {secondaryParts.length > 0
                          ? secondaryParts.join(' · ')
                          : item.notes?.trim() || 'Sin contacto'}
                      </Text>
                    </View>
                    <Pressable hitSlop={8} onPress={() => confirmRemove(item)}>
                      <Text style={styles.deleteText}>Eliminar</Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>
      ) : null}
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  addLink: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 4,
  },
  addLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
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
  contactMeta: {
    color: colors.textMuted,
    fontSize: 15,
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
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 18,
  },
  flex: {
    flex: 1,
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
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
