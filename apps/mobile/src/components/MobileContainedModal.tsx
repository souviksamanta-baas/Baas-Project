import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

type OverlayContextValue = {
  mount: (id: string, node: ReactNode) => void;
  unmount: (id: string) => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function MobileOverlayProvider(props: { children: ReactNode }): ReactElement {
  const [entries, setEntries] = useState<Array<{ id: string; node: ReactNode }>>([]);

  const value = useMemo<OverlayContextValue>(
    () => ({
      mount: (id, node) => {
        setEntries((current) => [...current.filter((entry) => entry.id !== id), { id, node }]);
      },
      unmount: (id) => {
        setEntries((current) => current.filter((entry) => entry.id !== id));
      },
    }),
    [],
  );

  return (
    <OverlayContext.Provider value={value}>
      <View style={styles.host}>
        {props.children}
        {Platform.OS === 'web' ? (
          <View pointerEvents="box-none" style={styles.overlayLayer}>
            {entries.map((entry) => (
              <View key={entry.id} pointerEvents="box-none" style={styles.overlayEntry}>
                {entry.node}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </OverlayContext.Provider>
  );
}

export function MobileContainedModal(props: {
  animationType?: 'fade' | 'slide';
  children: ReactNode;
  onClose: () => void;
  sheetStyle?: object;
  visible: boolean;
}): ReactElement | null {
  const overlayId = useMemo(
    () => `mobile-overlay-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const overlay = useContext(OverlayContext);

  const sheet = (
    <Pressable onPress={(event) => event.stopPropagation()} style={[styles.sheet, props.sheetStyle]}>
      {props.children}
    </Pressable>
  );

  const content = (
    <Pressable onPress={props.onClose} style={styles.backdrop}>
      {sheet}
    </Pressable>
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !overlay) {
      return;
    }

    if (props.visible) {
      overlay.mount(overlayId, content);
    } else {
      overlay.unmount(overlayId);
    }

    return () => {
      overlay.unmount(overlayId);
    };
  }, [content, overlay, overlayId, props.visible]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <Modal
      animationType={props.animationType ?? 'fade'}
      onRequestClose={props.onClose}
      transparent
      visible={props.visible}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  host: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  overlayEntry: {
    ...StyleSheet.absoluteFill,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 1000,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    padding: 16,
  },
});
