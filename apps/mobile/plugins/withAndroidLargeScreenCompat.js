const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Play Console flags portrait locks on large screens (Android 16+).
 * Clear our MainActivity lock via app.json `orientation: default`, and override
 * Google ML Kit Code Scanner's hardcoded PORTRAIT activity during manifest merge.
 */
const ML_KIT_BARCODE_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

function ensureToolsNamespace(manifest) {
  if (!manifest.$) {
    manifest.$ = {};
  }
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }
}

function upsertMlKitBarcodeActivity(application) {
  if (!application.activity) {
    application.activity = [];
  }

  const existing = application.activity.find(
    (activity) => activity?.$?.['android:name'] === ML_KIT_BARCODE_ACTIVITY,
  );

  const attrs = {
    'android:name': ML_KIT_BARCODE_ACTIVITY,
    'android:screenOrientation': 'unspecified',
    'android:exported': 'false',
    'tools:replace': 'android:screenOrientation',
  };

  if (existing) {
    existing.$ = {
      ...existing.$,
      ...attrs,
    };
    return;
  }

  application.activity.push({ $: attrs });
}

function withAndroidLargeScreenCompat(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    ensureToolsNamespace(manifest);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    upsertMlKitBarcodeActivity(application);

    return config;
  });
}

module.exports = withAndroidLargeScreenCompat;
