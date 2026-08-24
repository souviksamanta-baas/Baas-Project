import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Android edge-to-edge often ignores adjustResize, so the keyboard overlays the
 * window. Track height so screens can pad/scroll content above the keys.
 * Always 0 on iOS/web (those platforms use other inset APIs).
 */
export function useAndroidKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const onShow = Keyboard.addListener('keyboardDidShow', (event) => {
      setHeight(Math.max(0, Math.round(event.endCoordinates?.height ?? 0)));
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      setHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return height;
}

export function useAndroidKeyboardVisible(): boolean {
  return useAndroidKeyboardHeight() > 0;
}
