import type { ReactElement } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { styles } from '../styles';

export function LoadingScreen(): ReactElement {
  return (
    <View style={styles.card}>
      <ActivityIndicator />
      <Text style={styles.bodyText}>Checking session...</Text>
    </View>
  );
}
