import type { ReactElement, ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon, type IconKind } from './icons';
import { colors } from '../theme';

const ACTION_WIDTH = 76;
const LEFT_OPEN = ACTION_WIDTH * 3;
const RIGHT_OPEN = ACTION_WIDTH * 2;
const OPEN_THRESHOLD = 48;

function ActionTile(props: {
  backgroundColor: string;
  icon: IconKind;
  label: string;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.actionButton, { backgroundColor: props.backgroundColor }]}
    >
      <Icon color={colors.surface} kind={props.icon} size={22} strokeWidth={2} />
      <Text style={styles.actionLabel}>{props.label}</Text>
    </Pressable>
  );
}

export function SwipeableChatRow(props: {
  archived: boolean;
  children: ReactNode;
  isMuted: boolean;
  isPinned: boolean;
  isUnread: boolean;
  onArchive: () => void;
  onLongPress: () => void;
  onMore: () => void;
  onMute: () => void;
  onPin: () => void;
  onToggleRead: () => void;
  onUnarchive: () => void;
}): ReactElement {
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetX = useRef(0);

  function close(): void {
    offsetX.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }

  function runAndClose(action: () => void): void {
    close();
    action();
  }

  function openTo(target: number): void {
    offsetX.current = target;
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          translateX.stopAnimation((value) => {
            offsetX.current = value;
          });
        },
        onPanResponderMove: (_evt, gesture) => {
          const next = Math.max(
            -RIGHT_OPEN,
            Math.min(LEFT_OPEN, offsetX.current + gesture.dx),
          );
          translateX.setValue(next);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const current = offsetX.current + gesture.dx;
          const projected = current + gesture.vx * 24;

          if (projected > OPEN_THRESHOLD) {
            openTo(LEFT_OPEN);
          } else if (projected < -OPEN_THRESHOLD) {
            openTo(-RIGHT_OPEN);
          } else {
            close();
          }
        },
        onPanResponderTerminate: () => {
          close();
        },
      }),
    [translateX],
  );

  return (
    <View style={styles.container}>
      <View pointerEvents="box-none" style={styles.leftActions}>
        <ActionTile
          backgroundColor="#34C759"
          icon="check"
          label={props.isUnread ? 'Leído' : 'No leído'}
          onPress={() => runAndClose(props.onToggleRead)}
        />
        <ActionTile
          backgroundColor="#007AFF"
          icon="pin"
          label={props.isPinned ? 'Desfijar' : 'Fijar'}
          onPress={() => runAndClose(props.onPin)}
        />
        <ActionTile
          backgroundColor="#FF9500"
          icon="bell"
          label={props.isMuted ? 'Activar' : 'Silenciar'}
          onPress={() => runAndClose(props.onMute)}
        />
      </View>

      <View pointerEvents="box-none" style={styles.rightActions}>
        <ActionTile
          backgroundColor="#667781"
          icon="more"
          label="Más"
          onPress={() => runAndClose(props.onMore)}
        />
        <ActionTile
          backgroundColor="#25D366"
          icon="inbox"
          label={props.archived ? 'Desarchivar' : 'Archivar'}
          onPress={() =>
            runAndClose(props.archived ? props.onUnarchive : props.onArchive)
          }
        />
      </View>

      <Animated.View
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          delayLongPress={350}
          onLongPress={props.onLongPress}
          style={styles.rowPressable}
        >
          {props.children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    gap: 4,
    height: '100%',
    justifyContent: 'center',
    width: ACTION_WIDTH,
  },
  actionLabel: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  container: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  leftActions: {
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 0,
    width: LEFT_OPEN,
  },
  rightActions: {
    bottom: 0,
    flexDirection: 'row',
    position: 'absolute',
    right: 0,
    top: 0,
    width: RIGHT_OPEN,
  },
  row: {
    backgroundColor: colors.surface,
  },
  rowPressable: {
    backgroundColor: colors.surface,
  },
});
