import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { styles } from '../styles';

export function Metric(props: { label: string; value: number }): ReactElement {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{props.value}</Text>
      <Text style={styles.metricLabel}>{props.label}</Text>
    </View>
  );
}
