import { useCallback } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';

import { useAndroidBackHandler } from './useAndroidBackHandler';

/**
 * On Android, intercept Back when a form is dirty and ask before discarding.
 * Calls `onDiscard` when the user confirms leave.
 */
export function useAndroidUnsavedBack(params: {
  dirty: boolean;
  enabled?: boolean;
  message?: string;
  onDiscard: () => void;
  title?: string;
}): void {
  const enabled = (params.enabled ?? true) && params.dirty && Platform.OS === 'android';

  const onBack = useCallback(() => {
    Alert.alert(
      params.title ?? '¿Descartar cambios?',
      params.message ?? 'Si salís ahora, se perderán los cambios no guardados.',
      [
        { style: 'cancel', text: 'Seguir editando' },
        {
          style: 'destructive',
          text: 'Descartar',
          onPress: params.onDiscard,
        },
      ],
    );
    return true;
  }, [params.message, params.onDiscard, params.title]);

  useAndroidBackHandler(enabled, onBack);
}

/** Allow hardware back to exit the app only from authenticated root tabs. */
export function useAndroidRootExitBack(enabled: boolean): void {
  useAndroidBackHandler(enabled && Platform.OS === 'android', () => {
    BackHandler.exitApp();
    return true;
  });
}
