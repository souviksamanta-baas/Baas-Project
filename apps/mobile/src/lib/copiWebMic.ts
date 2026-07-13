function isPhoneOrContinuityMic(label: string): boolean {
  return /\b(iphone|ipad|ipod|continuity|iphone microphone|airpods)\b/i.test(label);
}

function isLikelyLaptopMic(label: string): boolean {
  if (!label.trim() || isPhoneOrContinuityMic(label)) {
    return false;
  }

  return /\b(macbook|built-?in|internal|default|microphone array|laptop|realtek|webcam|usb audio|microphone \()/i.test(
    label,
  );
}

export function isDesktopWebBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return !/\b(iphone|ipad|ipod|android|mobile)\b/i.test(navigator.userAgent);
}

/**
 * Prefer the laptop/local mic over Continuity (iPhone) devices that macOS exposes to Chrome.
 */
export async function resolvePreferredAudioConstraints(): Promise<{
  constraints: MediaStreamConstraints;
  label: string | null;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { constraints: { audio: true }, label: null };
  }

  const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  permissionStream.getTracks().forEach((track) => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === 'audioinput' && device.deviceId);

  const preferred =
    inputs.find((device) => isLikelyLaptopMic(device.label)) ??
    inputs.find((device) => device.label.trim().length > 0 && !isPhoneOrContinuityMic(device.label)) ??
    inputs[0] ??
    null;

  if (!preferred) {
    return { constraints: { audio: true }, label: null };
  }

  return {
    constraints: {
      audio: {
        deviceId: { exact: preferred.deviceId },
        echoCancellation: true,
        noiseSuppression: true,
      },
    },
    label: preferred.label || null,
  };
}

export function shouldPreferMediaRecorderOverSpeech(): boolean {
  return isDesktopWebBrowser();
}
