import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors } from '../theme';

/** Lightweight barcode bars for display/print (not a certified symbology renderer). */
export function ProductBarcodeSvg(props: { value: string; height?: number; width?: number }): ReactElement {
  const height = props.height ?? 96;
  const width = props.width ?? 280;
  const pattern = buildBars(props.value);
  const barWidth = width / Math.max(pattern.length, 1);

  return (
    <View style={styles.wrap}>
      <Svg height={height} width={width}>
        {pattern.map((filled, index) =>
          filled ? (
            <Rect
              fill={colors.navy}
              height={height}
              key={`${index}-${filled}`}
              width={Math.max(barWidth * 0.85, 1)}
              x={index * barWidth}
              y={0}
            />
          ) : null,
        )}
      </Svg>
    </View>
  );
}

function buildBars(value: string): boolean[] {
  const bars: boolean[] = [true, false, true, true, false];
  for (const char of value) {
    const code = char.charCodeAt(0);
    bars.push(true, false);
    for (let bit = 0; bit < 7; bit += 1) {
      bars.push(((code >> bit) & 1) === 1);
      bars.push(false);
    }
  }
  bars.push(true, false, true);
  return bars;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 8,
  },
});
