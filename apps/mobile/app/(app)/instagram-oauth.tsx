import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { completeInstagramOAuth } from '../../src/api/instagram';
import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { colors } from '../../src/design-system';
import { routes } from '../../src/navigation/routes';

/**
 * Deep link target for Meta Instagram Business Login:
 * baas-owner://instagram-oauth?code=...&state=...
 */
export default function InstagramOAuthCallbackRoute(): ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const session = useOwnerSessionContext();
  const [message, setMessage] = useState('Conectando Instagram…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;

    async function finish(): Promise<void> {
      if (params.error) {
        setMessage('La autorización fue cancelada o rechazada.');
        return;
      }
      if (!params.code || !params.state) {
        setMessage('Faltan parámetros de autorización.');
        return;
      }
      try {
        await completeInstagramOAuth({ code: params.code, state: params.state });
        await session.refreshDashboard();
        setMessage('Instagram conectado.');
        router.replace(routes.instagramConnect);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo completar la conexión.');
      }
    }

    void finish();
  }, [params.code, params.error, params.state, router, session]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    color: colors.navy,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  root: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
