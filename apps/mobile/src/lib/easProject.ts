import Constants from 'expo-constants';

/** EAS project id from app config; required for Expo push tokens on Android/iOS. */
export function getEasProjectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra.length > 0 && !fromExtra.startsWith('REPLACE_')) {
    return fromExtra;
  }

  const fromEasConfig = Constants.easConfig?.projectId;
  if (typeof fromEasConfig === 'string' && fromEasConfig.length > 0) {
    return fromEasConfig;
  }

  return undefined;
}
