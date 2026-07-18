import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  filterContactOptions,
  loadDeviceContacts,
  type DeviceContactOption,
} from '../api/customers';
import { Icon } from '../components/icons';
import { colors, radius, spacing } from '../design-system';

export function ContactPickerModal(props: {
  onClose: () => void;
  onSelect: (contact: DeviceContactOption) => void;
  visible: boolean;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<DeviceContactOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!props.visible) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    setQuery('');

    void loadDeviceContacts()
      .then((items) => {
        if (!cancelled) {
          setContacts(items);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los contactos.');
          setContacts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.visible]);

  const filtered = useMemo(() => filterContactOptions(contacts, query), [contacts, query]);

  return (
    <Modal animationType="slide" onRequestClose={props.onClose} visible={props.visible}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={props.onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
          <Text style={styles.title}>Elegir contacto</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchWrap}>
          <Icon kind="search" size={16} strokeWidth={1.8} />
          <TextInput
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Buscar nombre o número"
            placeholderTextColor={colors.slate}
            style={styles.searchInput}
            value={query}
          />
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && errorMessage ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!isLoading && !errorMessage ? (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={filtered}
            keyExtractor={(item, index) => `${item.displayName}-${item.rawPhone}-${index}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>No encontramos contactos.</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => props.onSelect(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.displayName)}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={styles.rowName}>
                    {item.displayName}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowPhone}>
                    {item.phoneE164 ?? item.rawPhone}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  closeButton: {
    minWidth: 64,
  },
  closeText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.slate,
    fontSize: 14,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerSpacer: {
    minWidth: 64,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  rowPhone: {
    color: colors.slate,
    fontSize: 13,
    marginTop: 2,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMint,
  },
  searchInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 12,
  },
  title: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '700',
  },
});
