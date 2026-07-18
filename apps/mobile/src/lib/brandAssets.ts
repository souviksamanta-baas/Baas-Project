import type { ImageSourcePropType } from 'react-native';

const DEFAULT_NEXOLIA_ICON = require('../../assets/images/nexolia-icon.png') as ImageSourcePropType;

/** Optional uploaded brand icon URI. Replace via `setNexoliaIconUri` when upload is wired. */
let uploadedNexoliaIconUri: string | null = null;

export function getNexoliaIconSource(): ImageSourcePropType {
  if (uploadedNexoliaIconUri) {
    return { uri: uploadedNexoliaIconUri };
  }

  return DEFAULT_NEXOLIA_ICON;
}

/** Call this when the business uploads a custom header icon. Pass `null` to restore the default. */
export function setNexoliaIconUri(uri: string | null): void {
  uploadedNexoliaIconUri = uri;
}
