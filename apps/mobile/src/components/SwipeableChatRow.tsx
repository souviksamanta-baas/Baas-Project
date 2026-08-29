import type { ReactElement, ReactNode } from 'react';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import { colors } from '../theme';

function ActionButton(props: {
  backgroundColor: string;
  label: string;
  onPress: () => void;
}): ReactElement {
  return (
    <RectButton
      onPress={props.onPress}
      style={[styles.actionButton, { backgroundColor: props.backgroundColor }]}
    >
      <Text style={styles.actionLabel}>{props.label}</Text>
    </RectButton>
  );
}

export function SwipeableChatRow(props: {
  archived: boolean;
  children: ReactNode;
  onArchive: () => void;
  onLongPress: () => void;
  onMore: () => void;
  onUnarchive: () => void;
  onUnread: () => void;
}): ReactElement {
  const swipeableRef = useRef<Swipeable | null>(null);

  function close(): void {
    swipeableRef.current?.close();
  }

  return (
    <Swipeable
      friction={2}
      leftThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      ref={swipeableRef}
      renderLeftActions={(_progress, dragX) => {
        const scale = dragX.interpolate({
          inputRange: [0, 80],
          outputRange: [0.85, 1],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View style={[styles.leftActions, { transform: [{ scale }] }]}>
            <ActionButton
              backgroundColor="#25D366"
              label="No leído"
              onPress={() => {
                close();
                props.onUnread();
              }}
            />
          </Animated.View>
        );
      }}
      renderRightActions={(_progress, dragX) => {
        const scale = dragX.interpolate({
          inputRange: [-160, 0],
          outputRange: [1, 0.85],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View style={[styles.rightActions, { transform: [{ scale }] }]}>
            <ActionButton
              backgroundColor="#667781"
              label="Más"
              onPress={() => {
                close();
                props.onMore();
              }}
            />
            {props.archived ? (
              <ActionButton
                backgroundColor="#25D366"
                label="Desarchivar"
                onPress={() => {
                  close();
                  props.onUnarchive();
                }}
              />
            ) : (
              <ActionButton
                backgroundColor="#25D366"
                label="Archivar"
                onPress={() => {
                  close();
                  props.onArchive();
                }}
              />
            )}
          </Animated.View>
        );
      }}
      rightThreshold={40}
    >
      <Pressable onLongPress={props.onLongPress} delayLongPress={350}>
        {props.children}
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 84,
  },
  actionLabel: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  leftActions: {
    flexDirection: 'row',
  },
  rightActions: {
    flexDirection: 'row',
  },
});
