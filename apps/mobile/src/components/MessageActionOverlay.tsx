import type { ReactElement } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../design-system';
import { ActionRow } from './ui';
import type { IconKind } from './icons';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export type MessageActionId =
  | 'reply'
  | 'forward'
  | 'copy'
  | 'edit'
  | 'ask-copi'
  | 'assign-label'
  | 'delete';

const ACTION_ROWS: Array<{ id: MessageActionId; icon: IconKind; title: string; danger?: boolean }> = [
  { id: 'reply', icon: 'message', title: 'Responder' },
  { id: 'forward', icon: 'share', title: 'Reenviar' },
  { id: 'copy', icon: 'document', title: 'Copiar' },
  { id: 'edit', icon: 'edit', title: 'Editar' },
  { id: 'ask-copi', icon: 'bot', title: 'Asignar a Copi' },
  { id: 'assign-label', icon: 'filter', title: 'Asignar etiqueta' },
  { id: 'delete', icon: 'trash', title: 'Eliminar', danger: true },
];

export function MessageActionOverlay(props: {
  canEdit: boolean;
  onAction: (action: MessageActionId) => void;
  onClose: () => void;
  onReact: (emoji: string) => void;
  selectedEmoji?: string | null;
  visible: boolean;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const visibleRows = ACTION_ROWS.filter((row) => (row.id === 'edit' ? props.canEdit : true));

  return (
    <Modal animationType="fade" onRequestClose={props.onClose} transparent visible={props.visible}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Cerrar menú"
          accessibilityRole="button"
          onPress={props.onClose}
          style={styles.backdrop}
        />
        <View
          pointerEvents="box-none"
          style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        >
          <View style={styles.emojiStrip}>
            {REACTION_EMOJIS.map((emoji) => {
              const selected = props.selectedEmoji === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => props.onReact(selected ? '' : emoji)}
                  style={[styles.emojiButton, selected && styles.emojiButtonSelected]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actionCard}>
            {visibleRows.map((row, index) => (
              <ActionRow
                danger={row.danger}
                icon={row.icon}
                key={row.id}
                onPress={() => props.onAction(row.id)}
                showChevron={false}
                showDivider={index < visibleRows.length - 1}
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
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 25, 53, 0.45)',
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  emoji: {
    fontSize: 28,
  },
  emojiButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emojiButtonSelected: {
    backgroundColor: colors.primarySoft,
  },
  emojiStrip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
