import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, type ReactElement } from 'react';
import { Text, View } from 'react-native';

import { useOwnerSessionContext } from '../src/context/OwnerSessionProvider';
import { approveBrowserSession } from '../src/lib/approveBrowserSession';
import { routes } from '../src/navigation/routes';
import { LoadingScreen } from '../src/screens/LoadingScreen';
import { styles } from '../src/styles';

export default function DesktopPairRoute(): ReactElement {
  const params = useLocalSearchParams<{ c?: string }>();
  const router = useRouter();
  const { authPhase, dashboard } = useOwnerSessionContext();
  const challengeId = typeof params.c === 'string' ? params.c : '';

  useEffect(() => {
    if (authPhase !== 'authenticated' || !challengeId) return;
    void approveBrowserSession(
      challengeId,
      dashboard?.organization?.id,
      dashboard?.organization?.name,
    ).finally(() => {
      router.replace(routes.appHome);
    });
  }, [authPhase, challengeId, dashboard?.organization?.id, dashboard?.organization?.name, router]);

  if (authPhase === 'loading') {
    return <LoadingScreen />;
  }

  if (authPhase !== 'authenticated') {
    return (
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Iniciá sesión en Nexolia y volvé a escanear el código de la computadora.
        </Text>
      </View>
    );
  }

  return <LoadingScreen />;
}
