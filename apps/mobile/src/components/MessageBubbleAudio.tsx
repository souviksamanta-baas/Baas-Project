import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { colors, spacing } from '../design-system';
import { resolveWhatsAppMediaUrl } from '../lib/whatsappMedia';
import { Icon } from './icons';

let activeVoicePlayerId: string | null = null;
const voicePlayerStopListeners = new Map<string, () => void>();

function claimVoicePlayback(id: string, stop: () => void): void {
  if (activeVoicePlayerId && activeVoicePlayerId !== id) {
    voicePlayerStopListeners.get(activeVoicePlayerId)?.();
  }
  activeVoicePlayerId = id;
  voicePlayerStopListeners.set(id, stop);
}

function releaseVoicePlayback(id: string): void {
  if (activeVoicePlayerId === id) {
    activeVoicePlayerId = null;
  }
  voicePlayerStopListeners.delete(id);
}

function formatDuration(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MessageBubbleAudio(props: {
  mediaDurationMs?: number | null;
  mediaStoragePath?: string | null;
  mediaUrl?: string | null;
  messageId: string;
}): ReactElement {
  const [uri, setUri] = useState<string | null>(props.mediaUrl ?? null);
  const [loadError, setLoadError] = useState(false);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const stopRef = useRef(() => {
    try {
      player.pause();
    } catch {
      // ignore
    }
  });

  useEffect(() => {
    stopRef.current = () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [player]);

  useEffect(() => {
    const id = props.messageId;
    voicePlayerStopListeners.set(id, () => stopRef.current());
    return () => {
      releaseVoicePlayback(id);
    };
  }, [props.messageId]);

  useEffect(() => {
    let cancelled = false;
    if (props.mediaUrl) {
      setUri(props.mediaUrl);
      setLoadError(false);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const nextUri = await resolveWhatsAppMediaUrl({
          mediaStoragePath: props.mediaStoragePath,
          mediaUrl: props.mediaUrl,
        });
        if (!cancelled) {
          setUri(nextUri);
          setLoadError(!nextUri);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.mediaStoragePath, props.mediaUrl]);

  const durationMs =
    props.mediaDurationMs && props.mediaDurationMs > 0
      ? props.mediaDurationMs
      : status.duration > 0
        ? status.duration * 1000
        : null;
  const currentMs = status.currentTime > 0 ? status.currentTime * 1000 : 0;
  const progress =
    durationMs && durationMs > 0 ? Math.min(1, Math.max(0, currentMs / durationMs)) : 0;

  async function togglePlayback(): Promise<void> {
    if (!uri || loadError) {
      return;
    }
    if (status.playing) {
      player.pause();
      releaseVoicePlayback(props.messageId);
      return;
    }
    claimVoicePlayback(props.messageId, () => stopRef.current());
    try {
      if (status.currentTime > 0 && status.duration > 0 && status.currentTime >= status.duration - 0.25) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      setLoadError(true);
    }
  }

  if (loadError) {
    return (
      <View style={styles.row}>
        <Text style={styles.errorText}>No se pudo reproducir</Text>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.row}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.label}>Nota de voz</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable hitSlop={8} onPress={() => void togglePlayback()} style={styles.playButton}>
        <Icon
          color={colors.primary}
          filled
          kind={status.playing ? 'pause' : 'play'}
          size={18}
          strokeWidth={1.6}
        />
      </Pressable>
      <View style={styles.trackColumn}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { flex: progress }]} />
          <View style={{ flex: Math.max(0.001, 1 - progress) }} />
        </View>
        <Text style={styles.duration}>
          {formatDuration(status.playing || currentMs > 0 ? currentMs : null)}
          {' / '}
          {formatDuration(durationMs)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  duration: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  playButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  progressTrack: {
    backgroundColor: colors.borderSoft,
    borderRadius: 999,
    flexDirection: 'row',
    height: 4,
    overflow: 'hidden',
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    minWidth: 180,
  },
  trackColumn: {
    flex: 1,
  },
});
