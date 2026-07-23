import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Registers an Android hardware / gesture back handler.
 * Return true from `onBack` to consume the event (e.g. close a sheet).
 */
export function useAndroidBackHandler(enabled: boolean, onBack: () => boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [enabled, onBack]);
}
