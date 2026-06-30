import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { StaffInviteScreen } from '../../src/screens/StaffInviteScreen';
import { styles } from '../../src/styles';

export default function StaffInviteRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();

  if (!dashboard?.organization?.id) {
    return (
      <View style={styles.card}>
        <Text style={styles.bodyText}>Necesitás una sesión activa para invitar miembros.</Text>
      </View>
    );
  }

  return (
    <StaffInviteScreen
      dashboard={dashboard}
      onBack={() => router.back()}
    />
  );
}
