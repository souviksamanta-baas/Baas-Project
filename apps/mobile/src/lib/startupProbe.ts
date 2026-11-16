import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiFetchAuthJson } from '../api/client';

export const STARTUP_YIELD_MS = 1000;

const TICK_MS = 250;
const WINDOW_MS = 20_000;
const MAX_REPORTED_MS = 60_000;

let running = false;
let startedAt = 0;
let lastTick = 0;
let maxStallMs = 0;
let firstTapAt: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function clampMs(value: number): number {
  return Math.max(0, Math.min(MAX_REPORTED_MS, Math.round(value)));
}

function deviceInfo(): { deviceModel: string; osVersion: string; platform: string } {
  if (Platform.OS === 'android') {
    const constants = Platform.constants as {
      Brand?: string;
      Model?: string;
      Release?: string;
    };
    return {
      deviceModel: [constants.Brand, constants.Model].filter(Boolean).join(' ').slice(0, 80),
      osVersion: (constants.Release ?? String(Platform.Version)).slice(0, 40),
      platform: 'android',
    };
  }

  return {
    deviceModel: Platform.OS,
    osVersion: String(Platform.Version).slice(0, 40),
    platform: Platform.OS,
  };
}

function stopTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function postSample(organizationId: string): Promise<void> {
  const info = deviceInfo();
  const appVersion =
    typeof Constants.expoConfig?.version === 'string' ? Constants.expoConfig.version : null;

  await apiFetchAuthJson('/notifications/startup-sample', {
    body: JSON.stringify({
      appVersion,
      deviceModel: info.deviceModel,
      maxStallMs: clampMs(maxStallMs),
      organizationId,
      osVersion: info.osVersion,
      platform: info.platform,
      timeToFirstTapMs: firstTapAt == null ? null : clampMs(firstTapAt - startedAt),
    }),
    method: 'POST',
  });
}

function tick(organizationId: string): void {
  const now = Date.now();
  const lateness = now - lastTick - TICK_MS;
  if (lateness > maxStallMs) {
    maxStallMs = lateness;
  }
  lastTick = now;

  if (now - startedAt >= WINDOW_MS) {
    running = false;
    timer = null;
    void postSample(organizationId).catch(() => undefined);
    return;
  }

  timer = setTimeout(() => tick(organizationId), TICK_MS);
}

export function startStartupProbe(organizationId: string): void {
  if (running || !organizationId) {
    return;
  }

  running = true;
  startedAt = Date.now();
  lastTick = startedAt;
  maxStallMs = 0;
  firstTapAt = null;
  stopTimer();
  timer = setTimeout(() => tick(organizationId), TICK_MS);
}

export function markStartupFirstTap(): void {
  if (!running || firstTapAt != null) {
    return;
  }

  firstTapAt = Date.now();
}
