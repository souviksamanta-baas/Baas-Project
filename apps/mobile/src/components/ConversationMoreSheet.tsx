import type { ReactElement } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../design-system';
import { ActionRow } from './ui';
import type { IconKind } from './icons';

type ConversationMoreAction =
  | 'toggle-read'
  | 'toggle-pin'
  | 'mute'
  | 'archive'
  | 'clear'
  | 'delete';

export function ConversationMoreSheet(props: {
  archived: boolean;
  isMuted: boolean;
  isPinned: boolean;
  isUnread: boolean;
  onAction: (action: ConversationMoreAction) => void;
  onClose: () => void;
  title: string;
  visible: boolean;
}): ReactElement {
  const insets = useSafeAreaInsets();

  const rows: Array<{
    action: ConversationMoreAction;
    danger?: boolean;
    icon: IconKind;
    title: string;
  }> = [
    {
      action: 'toggle-read',
      icon: 'check',
      title: props.isUnread ? 'Marcar como leído' : 'Marcar como no leído',
    },
    {
      action: 'toggle-pin',
      icon: 'pin',
      title: props.isPinned ? 'Desfijar' : 'Fijar',
    },
    {
      action: 'mute',
      icon: 'bell',
      title: props.isMuted ? 'Activar notificaciones' : 'Silenciar',
    },
    {
      action: 'archive',
      icon: 'inbox',
      title: props.archived ? 'Desarchivar' : 'Archivar',
    },
    {
      action: 'clear',
      icon: 'document',
      title: 'Vaciar chat',
    },
    {
      action: 'delete',
      danger: true,
      icon: 'trash',
      title: 'Eliminar chat',
    },
  ];

  return (
    <Modal animationType="fade" onRequestClose={props.onClose} transparent visible={props.visible}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" onPress={props.onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Text style={styles.title}>{props.title}</Text>
          <View style={styles.card}>
            {rows.map((row, index) => (
              <ActionRow
                danger={row.danger}
                icon={row.icon}
                key={row.action}
                onPress={() => props.onAction(row.action)}
                showChevron={false}
                showDivider={index < rows.length - 1}
                title={row.title}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 25, 53, 0.45)',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
});
