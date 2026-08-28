import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

export async function shareHtmlAsPdf(params: {
  fileName: string;
  html: string;
  shareTitle: string;
}): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: params.html });

  if (Platform.OS === 'ios' || (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, {
      dialogTitle: params.shareTitle,
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  await Share.share({
    message: params.shareTitle,
    title: params.shareTitle,
    url: uri,
  });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
