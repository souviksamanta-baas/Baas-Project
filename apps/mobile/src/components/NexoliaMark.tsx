import type { ReactElement } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { getNexoliaIconSource } from '../lib/brandAssets';

/**
 * Circular Nexolia brand mark for the collapsed app header.
 * Uses the bundled square icon (cropped to a circle). Swap via `setNexoliaIconUri` later.
 */
export function NexoliaMark(props: { size?: number; uri?: string | null }): ReactElement {
  const size = props.size ?? 32;
  const source = props.uri ? { uri: props.uri } : getNexoliaIconSource();

  return (
    <View style={[styles.frame, { borderRadius: size / 2, height: size, width: size }]}>
      <Image accessibilityLabel="Nexolia" resizeMode="cover" source={source} style={{ height: size, width: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
