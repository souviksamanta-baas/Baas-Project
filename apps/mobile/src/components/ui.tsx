import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  findNodeHandle,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Channel, DashboardMetricMock, NotificationMock, Tone } from '../api/mockData';
import {
  Card as DsCard,
  ComposerInput,
  SectionHeader as DsSectionHeader,
  StatusDot,
  colors,
  getBottomNavClearance,
  layout,
  radius,
  shadows,
  spacing,
  textStyles,
  typography,
} from '../design-system';
import { useHeaderChromeOptional } from '../context/HeaderChromeProvider';
import { useProfileChromeOptional } from '../context/ProfileChromeProvider';
import { parseCopiRichText } from '../lib/copiRichText';
import { resolveWhatsAppMediaUrl } from '../lib/whatsappMedia';
import { ChannelIcon, CopiRobotIcon, Icon } from './icons';
import type { IconKind } from './icons';
import { NexoliaMark } from './NexoliaMark';

export type AppTab = 'copi' | 'home' | 'inbox' | 'more';
type MessageSource = Channel | 'copi' | 'owner';

const HEADER_COLLAPSE_OFFSET = 28;

/** Use on FlatList/ScrollView when ScreenContent has disableScroll. */
export function useHeaderCollapseOnScroll(): (offsetY: number) => void {
  const chrome = useHeaderChromeOptional();
  return (offsetY: number) => {
    chrome.setCollapsed(offsetY > HEADER_COLLAPSE_OFFSET);
  };
}

export function AppHeader(props: {
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
  unreadNotificationCount?: number;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const chrome = useHeaderChromeOptional();
  const profile = useProfileChromeOptional();
  const showCollapsed = chrome.collapseEnabled && chrome.collapsed;
  const hasUnread = (props.unreadNotificationCount ?? 0) > 0;

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
      <View style={styles.headerMain}>
        {showCollapsed ? (
          <>
            <View style={styles.headerLeading}>
              {chrome.onBack ? (
                <Pressable
                  accessibilityLabel="Volver"
                  hitSlop={8}
                  onPress={chrome.onBack}
                  style={styles.headerBackPressable}
                >
                  <Text style={styles.headerBackText}>‹</Text>
                </Pressable>
              ) : (
                <NexoliaMark size={32} />
              )}
            </View>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {chrome.title ?? ''}
            </Text>
          </>
        ) : (
          <View style={styles.headerBrand}>
            <Text style={styles.logo}>nexolia</Text>
            <Text style={styles.logoTagline}>Tu negocio, mas inteligente</Text>
          </View>
        )}
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel={
              hasUnread
                ? `Notificaciones, ${props.unreadNotificationCount} sin leer`
                : 'Notificaciones'
            }
            onPress={props.onOpenNotifications}
            style={styles.headerIcon}
          >
            <Icon kind="bell" size={26} strokeWidth={1.7} />
            {hasUnread ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Pressable onPress={props.onOpenAccount} style={styles.ownerAvatar}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.ownerAvatarImage} />
            ) : (
              <View style={styles.ownerHair} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ScreenContent(props: {
  children: ReactNode;
  /** Defaults to true on every screen; pass false on Home to keep the text logo. */
  collapseHeaderOnScroll?: boolean;
  /** When true, children manage their own scrolling (e.g. FlatList). */
  disableScroll?: boolean;
  title?: string;
}): ReactElement {
  const chrome = useHeaderChromeOptional();
  const insets = useSafeAreaInsets();
  const collapseHeaderOnScroll = props.collapseHeaderOnScroll !== false;
  const bottomClearance = getBottomNavClearance(insets.bottom);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!collapseHeaderOnScroll) {
      chrome.setChrome({ collapseEnabled: false, collapsed: false, onBack: null, title: null });
      return () => {
        chrome.resetChrome();
      };
    }

    chrome.setChrome({ collapseEnabled: true });
    return () => {
      chrome.resetChrome();
    };
  }, [chrome.resetChrome, chrome.setChrome, collapseHeaderOnScroll]);

  useEffect(() => {
    if (!collapseHeaderOnScroll || props.title == null) {
      return;
    }

    chrome.setChrome({ title: props.title });
  }, [chrome.setChrome, collapseHeaderOnScroll, props.title]);

  useEffect(() => {
    if (props.disableScroll) {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates?.height ?? 0;
      if (Platform.OS === 'ios') {
        // iOS: ScrollView.automaticallyAdjustKeyboardInsets handles most of it;
        // keep a small cushion so sticky footers / last fields clear the keys.
        setKeyboardLift(Math.max(spacing.xl, Math.round(height * 0.08)));
        return;
      }

      // Android edge-to-edge: window often does not resize — pad the full keyboard
      // height so the ScrollView can actually scroll content out from under it.
      setKeyboardLift(Math.max(0, Math.round(height)));

      // Scroll the focused field above the keyboard after padding applies.
      requestAnimationFrame(() => {
        const focused = TextInput.State.currentlyFocusedInput?.();
        const node = focused ? findNodeHandle(focused) : null;
        const responder = scrollRef.current?.getScrollResponder?.() as
          | {
              scrollResponderScrollNativeHandleToKeyboard?: (
                nodeHandle: number,
                offset: number,
                animated: boolean,
              ) => void;
            }
          | undefined;
        if (node != null && responder?.scrollResponderScrollNativeHandleToKeyboard) {
          responder.scrollResponderScrollNativeHandleToKeyboard(
            node,
            Math.round(height) + spacing.xl,
            true,
          );
        }
      });
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardLift(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [props.disableScroll]);

  if (props.disableScroll) {
    return <View style={{ flex: 1 }}>{props.children}</View>;
  }

  // When the keyboard is open on Android the bottom nav is hidden, so drop that
  // clearance and rely on keyboardLift alone.
  const paddingBottom =
    Platform.OS === 'android' && keyboardLift > 0
      ? keyboardLift + spacing.md
      : bottomClearance + keyboardLift;

  return (
    <ScrollView
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={[styles.content, { paddingBottom }]}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      onScroll={(event) => {
        if (!collapseHeaderOnScroll) {
          return;
        }

        chrome.setCollapsed(event.nativeEvent.contentOffset.y > HEADER_COLLAPSE_OFFSET);
      }}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={styles.screenScroll}
    >
      {props.children}
    </ScrollView>
  );
}

export function ScreenTitle(props: {
  onBack?: () => void;
  subtitle?: string;
  title: string;
  /** Optional rich title (e.g. inline links). Chrome collapse still uses `title`. */
  titleNode?: ReactNode;
}): ReactElement {
  const chrome = useHeaderChromeOptional();

  useEffect(() => {
    chrome.setChrome({
      collapseEnabled: true,
      onBack: props.onBack ?? null,
      title: props.title,
    });
  }, [chrome.setChrome, props.onBack, props.title]);

  return (
    <View>
      <Text style={styles.screenTitle}>{props.titleNode ?? props.title}</Text>
      {props.subtitle ? <Text style={textStyles.pageSubtitle}>{props.subtitle}</Text> : null}
    </View>
  );
}

export function Card(props: { children: ReactNode; flush?: boolean; style?: object }): ReactElement {
  return (
    <DsCard flush={props.flush} style={props.style}>
      {props.children}
    </DsCard>
  );
}

export function SectionHeader(props: { actionLabel?: string; onAction?: () => void; title: string }): ReactElement {
  return <DsSectionHeader {...props} style={styles.sectionHeaderPad} />;
}

export function MetricGrid(props: {
  metrics: DashboardMetricMock[];
  onMetricPress?: (metricId: string) => void;
}): ReactElement {
  return (
    <View style={styles.metricGrid}>
      {props.metrics.map((metric) => {
        const content = (
          <>
            <MetricIcon metricId={metric.id} tone={metric.tone} />
            <Text numberOfLines={1} style={[styles.metricValue, toneText(metric.tone)]}>
              {metric.value}
            </Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </>
        );

        if (props.onMetricPress) {
          return (
            <Pressable
              accessibilityRole="button"
              key={metric.id}
              onPress={() => props.onMetricPress?.(metric.id)}
              style={styles.metricItem}
            >
              {content}
            </Pressable>
          );
        }

        return (
          <View key={metric.id} style={styles.metricItem}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

export function ConversationRow(props: {
  avatar: string;
  channel: Channel;
  name: string;
  onPress?: () => void;
  preview: string;
  showDivider?: boolean;
  statusLabel?: string;
  time: string;
  unreadCount?: number;
}): ReactElement {
  const showDivider = props.showDivider !== false;

  return (
    <Pressable onPress={props.onPress} style={styles.listRow}>
      <Avatar channel={props.channel} label={props.avatar} />
      <View style={[styles.listRowContent, showDivider && styles.listRowContentDivider]}>
        <View style={styles.flexShrink}>
          <Text numberOfLines={1} style={styles.listTitle}>{props.name}</Text>
          <Text numberOfLines={1} style={styles.listDescription}>{props.preview}</Text>
          {props.statusLabel ? <Text numberOfLines={1} style={styles.leadBadge}>{props.statusLabel}</Text> : null}
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.timestamp}>{props.time}</Text>
          {props.unreadCount ? <Text style={styles.unreadBadge}>{props.unreadCount}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function NotificationRow(props: {
  notification: NotificationMock | {
    id: string;
    subtitle?: string | null;
    time: string;
    title: string;
    tone: Tone;
    unread?: boolean;
  };
  onPress?: () => void;
  showDivider?: boolean;
}): ReactElement {
  const showDivider = props.showDivider !== false;
  const content = (
    <>
      <ToneIcon tone={props.notification.tone} />
      <View style={[styles.listRowContent, showDivider && styles.listRowContentDivider]}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.listTitle}>{props.notification.title}</Text>
          {props.notification.subtitle ? (
            <Text numberOfLines={1} style={styles.listDescription}>{props.notification.subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.notificationMeta}>
          <Text style={styles.timestamp}>{props.notification.time}</Text>
          {props.notification.unread ? <StatusDot /> : null}
        </View>
      </View>
    </>
  );

  if (props.onPress) {
    return (
      <Pressable onPress={props.onPress} style={styles.listRow}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.listRow}>{content}</View>;
}

export function ActionRow(props: {
  danger?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  icon?: IconKind;
  onPress?: () => void;
  showChevron?: boolean;
  showDivider?: boolean;
  subtitle?: string;
  title: string;
}): ReactElement {
  const isDisabled = props.disabled === true || props.onPress == null;
  const showDivider = props.showDivider !== false;
  const showChevron = props.showChevron !== false && !isDisabled;
  const chevronKind =
    props.expanded === true ? 'chevron-up' : props.expanded === false ? 'chevron-down' : 'chevron-right';

  return (
    <Pressable
      disabled={isDisabled}
      onPress={props.onPress}
      style={[styles.actionRow, isDisabled && styles.actionRowDisabled]}
    >
      <View style={styles.actionIconPlain}>
        <ActionIcon
          color={isDisabled ? colors.textMuted : props.danger ? colors.danger : colors.primary}
          kind={props.icon ?? 'message'}
        />
      </View>
      <View style={[styles.actionContent, showDivider && styles.actionContentDivider]}>
        <View style={styles.flex}>
          <Text
            style={[
              styles.actionTitle,
              props.danger && styles.dangerText,
              isDisabled && styles.actionRowDisabledText,
            ]}
          >
            {props.title}
          </Text>
          {props.subtitle ? (
            <Text numberOfLines={1} style={[styles.listDescription, isDisabled && styles.actionRowDisabledText]}>
              {props.subtitle}
            </Text>
          ) : null}
        </View>
        {showChevron ? (
          <Icon color="#c7c7cc" kind={chevronKind} size={20} strokeWidth={2.4} />
        ) : null}
      </View>
    </Pressable>
  );
}

function ActionIcon(props: { color: string; kind: IconKind }): ReactElement {
  if (props.kind === 'whatsapp' || props.kind === 'instagram' || props.kind === 'facebook' || props.kind === 'email') {
    return <ChannelIcon channel={props.kind} size={26} />;
  }

  return <Icon color={props.color} kind={props.kind} size={26} strokeWidth={1.7} />;
}

export function MessageBubble(props: {
  direction: 'inbound' | 'outbound';
  editedAt?: string | null;
  linkPreview?: {
    description?: string | null;
    imageUrl?: string | null;
    title?: string | null;
    url?: string | null;
  } | null;
  mediaMimeType?: string | null;
  mediaStoragePath?: string | null;
  mediaUrl?: string | null;
  messageType?: string | null;
  onLongPress?: () => void;
  onPressPresupuesto?: (quoteId: string) => void;
  onPressProduct?: (productId: string) => void;
  source?: MessageSource;
  text: string;
  time: string;
}): ReactElement {
  const outbound = props.direction === 'outbound';
  const showCopiTag = props.source === 'copi';
  const parts = parseCopiRichText(props.text);
  const hasText = Boolean(props.text.trim());
  const isAudio =
    props.messageType === 'audio' ||
    (props.mediaMimeType?.startsWith('audio/') ?? false);
  const hasImage = !isAudio && Boolean(props.mediaUrl || props.mediaStoragePath);
  const preview = props.linkPreview;
  const hasPreview = Boolean(preview?.url || preview?.title);

  return (
    <Pressable
      delayLongPress={280}
      onLongPress={props.onLongPress}
      style={[styles.messageWrap, outbound && styles.outboundMessageWrap]}
    >
      <View style={[styles.messageBubble, outbound && styles.outboundMessageBubble]}>
        {showCopiTag ? <MessageSourceBadge source="copi" /> : null}
        {hasImage ? (
          <MessageBubbleImage
            mediaStoragePath={props.mediaStoragePath}
            mediaUrl={props.mediaUrl}
          />
        ) : null}
        {hasPreview ? (
          <View style={styles.linkPreviewCard}>
            {preview?.imageUrl ? (
              <Image source={{ uri: preview.imageUrl }} style={styles.linkPreviewImage} />
            ) : null}
            {preview?.title ? (
              <Text numberOfLines={2} style={styles.linkPreviewTitle}>
                {preview.title}
              </Text>
            ) : null}
            {preview?.description ? (
              <Text numberOfLines={2} style={styles.linkPreviewDescription}>
                {preview.description}
              </Text>
            ) : null}
            {preview?.url ? (
              <Text numberOfLines={1} style={styles.linkPreviewUrl}>
                {preview.url}
              </Text>
            ) : null}
          </View>
        ) : null}
        {hasText ? (
          <Text style={styles.messageText}>
            {parts.map((part, index) => {
              if (part.type === 'text') {
                return <Text key={`t-${index}`}>{part.value}</Text>;
              }

              if (part.type === 'presupuesto') {
                if (!props.onPressPresupuesto || !part.quoteId) {
                  return (
                    <Text key={`q-${index}`} style={styles.productLinkText}>
                      {part.label}
                    </Text>
                  );
                }

                return (
                  <Text
                    key={`q-${index}`}
                    onPress={() => props.onPressPresupuesto?.(part.quoteId)}
                    style={styles.productLinkText}
                  >
                    {part.label}
                  </Text>
                );
              }

              if (!props.onPressProduct || !part.productId) {
                return (
                  <Text key={`p-${index}`} style={styles.productLinkText}>
                    {part.label}
                  </Text>
                );
              }

              return (
                <Text
                  key={`p-${index}`}
                  onPress={() => props.onPressProduct?.(part.productId)}
                  style={styles.productLinkText}
                >
                  {part.label}
                </Text>
              );
            })}
          </Text>
        ) : null}
        <Text style={styles.messageTime}>
          {props.editedAt ? `Editado · ${props.time}` : props.time}
        </Text>
      </View>
    </Pressable>
  );
}

function MessageBubbleImage(props: {
  mediaStoragePath?: string | null;
  mediaUrl?: string | null;
}): ReactElement | null {
  const [uri, setUri] = useState<string | null>(props.mediaUrl ?? null);

  useEffect(() => {
    let cancelled = false;
    if (props.mediaUrl) {
      setUri(props.mediaUrl);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const nextUri = await resolveWhatsAppMediaUrl({
        mediaStoragePath: props.mediaStoragePath,
        mediaUrl: props.mediaUrl,
      });
      if (!cancelled) {
        setUri(nextUri);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.mediaStoragePath, props.mediaUrl]);

  if (!uri) {
    return (
      <View style={styles.messageImagePlaceholder}>
        <Text style={styles.messageImagePlaceholderText}>📷 Cargando foto…</Text>
      </View>
    );
  }

  return (
    <Image
      onError={() => {
        if (!props.mediaStoragePath) {
          return;
        }
        void resolveWhatsAppMediaUrl({
          mediaStoragePath: props.mediaStoragePath,
          mediaUrl: null,
        }).then((nextUri) => {
          if (nextUri) {
            setUri(nextUri);
          }
        });
      }}
      source={{ uri }}
      resizeMode="cover"
      style={styles.messageImage}
    />
  );
}

function MessageSourceBadge(props: { source: MessageSource }): ReactElement {
  const source = messageSourceMeta(props.source);
  const channel = isChannelSource(props.source) ? props.source : null;

  return (
    <View style={[styles.messageSourceBadge, { backgroundColor: source.background }]}>
      {channel ? (
        <ChannelIcon channel={channel} size={12} />
      ) : (
        <Icon color={source.color} kind={props.source === 'copi' ? 'bot' : 'store'} size={12} strokeWidth={2} />
      )}
      <Text style={[styles.messageSourceText, { color: source.color }]}>{source.label}</Text>
    </View>
  );
}

export function ReplyComposer(props: {
  attachmentMenuOpen?: boolean;
  canUseVision?: boolean;
  canUseVoice?: boolean;
  embedded?: boolean;
  editable?: boolean;
  isAnalyzingImage?: boolean;
  isRecordingVoice?: boolean;
  isSending?: boolean;
  isTranscribingVoice?: boolean;
  onChangeText?: (text: string) => void;
  onClearPendingImage?: () => void;
  onPressAttachCamera?: () => void;
  onPressAttachLibrary?: () => void;
  onPressPlus?: () => void;
  onPressVoice?: () => void;
  onSend?: () => void;
  pendingImageHint?: string;
  pendingImageUri?: string | null;
  placeholder: string;
  value?: string;
  /** Client chats: voice notes. Copi: speech-to-text into the text box. */
  voiceMode?: 'voice-note' | 'stt';
}): ReactElement {
  const hasText = Boolean(props.value?.trim());
  const hasPendingImage = Boolean(props.pendingImageUri);
  const busy = props.isSending || props.isTranscribingVoice || props.isAnalyzingImage;
  const canSend = Boolean(props.onSend && (hasText || hasPendingImage) && !busy);
  const showVoice = Boolean(props.canUseVoice && !hasText && !hasPendingImage && props.onPressVoice);
  const emptyComposerUsesVoice = Boolean(!hasText && !hasPendingImage && props.onPressVoice);
  const showAttachmentSheet = Boolean(
    props.attachmentMenuOpen && (props.onPressAttachCamera || props.onPressAttachLibrary),
  );
  const insets = useSafeAreaInsets();
  const recordingShowsSend =
    Boolean(props.isRecordingVoice) && (props.voiceMode === 'voice-note' || !props.voiceMode);

  function closeAttachmentSheet(): void {
    if (props.attachmentMenuOpen && props.onPressPlus) {
      props.onPressPlus();
    }
  }

  function handleTrailingPress(): void {
    if (showVoice || emptyComposerUsesVoice || props.isRecordingVoice) {
      props.onPressVoice?.();
      return;
    }
    if (canSend) {
      props.onSend?.();
    }
  }

  const trailingKind =
    recordingShowsSend || canSend
      ? 'send'
      : showVoice || emptyComposerUsesVoice
        ? 'mic'
        : 'send';

  const recordingHint =
    props.voiceMode === 'stt'
      ? 'Escuchando… tocá el micrófono para terminar. Revisá el texto antes de enviar.'
      : 'Grabando… tocá enviar para mandar el audio.';

  return (
    <View
      style={[
        styles.replyBarWrap,
        props.embedded && styles.replyBarWrapEmbedded,
        !props.embedded && { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      {props.pendingImageUri ? (
        <View style={styles.pendingImageRow}>
          <Image source={{ uri: props.pendingImageUri }} style={styles.pendingImageThumb} />
          <Text style={styles.pendingImageLabel}>
            {props.pendingImageHint ?? 'Imagen lista. Escribí tu pregunta y enviá.'}
          </Text>
          <Pressable hitSlop={8} onPress={props.onClearPendingImage}>
            <Text style={styles.pendingImageClear}>Quitar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.replyBar, props.embedded && styles.replyBarEmbedded]}>
        <ComposerInput
          editable={props.editable ?? true}
          leadingIcon={props.onPressPlus ? (showAttachmentSheet ? 'x' : 'plus') : undefined}
          onChangeText={props.onChangeText}
          onLeadingPress={props.onPressPlus}
          onSubmitEditing={canSend ? props.onSend : undefined}
          placeholder={props.placeholder}
          returnKeyType="send"
          value={props.value}
          trailing={
            <Pressable
              disabled={busy && !(showVoice || emptyComposerUsesVoice)}
              onPress={handleTrailingPress}
              style={[
                styles.micButton,
                props.isRecordingVoice && styles.micButtonRecording,
                (showVoice || emptyComposerUsesVoice) &&
                  !props.isRecordingVoice &&
                  styles.micButtonIdle,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Icon color={colors.surface} kind={trailingKind} size={19} strokeWidth={2.2} />
              )}
            </Pressable>
          }
        />
      </View>
      {props.isRecordingVoice ? (
        <Text style={styles.recordingHint}>{recordingHint}</Text>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={closeAttachmentSheet}
        transparent
        visible={showAttachmentSheet}
      >
        <View style={styles.attachmentModalRoot}>
          <Pressable onPress={closeAttachmentSheet} style={styles.attachmentBackdrop} />
          <View
            style={[
              styles.attachmentSheet,
              { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
            ]}
          >
            <View style={styles.attachmentSheetHandle} />
            <Text style={styles.attachmentSheetTitle}>Adjuntar</Text>
            <View style={styles.attachmentGrid}>
              {props.onPressAttachCamera ? (
                <Pressable
                  onPress={() => {
                    closeAttachmentSheet();
                    // Let the sheet dismiss before opening the system picker (iOS).
                    setTimeout(() => {
                      props.onPressAttachCamera?.();
                    }, 280);
                  }}
                  style={styles.attachmentCircleOption}
                >
                  <View style={[styles.attachmentCircle, styles.attachmentCircleCamera]}>
                    <Icon color={colors.surface} kind="camera" size={24} strokeWidth={1.9} />
                  </View>
                  <Text style={styles.attachmentCircleLabel}>Cámara</Text>
                </Pressable>
              ) : null}
              {props.onPressAttachLibrary ? (
                <Pressable
                  onPress={() => {
                    closeAttachmentSheet();
                    setTimeout(() => {
                      props.onPressAttachLibrary?.();
                    }, 280);
                  }}
                  style={styles.attachmentCircleOption}
                >
                  <View style={[styles.attachmentCircle, styles.attachmentCircleGallery]}>
                    <Icon color={colors.surface} kind="image" size={24} strokeWidth={1.9} />
                  </View>
                  <Text style={styles.attachmentCircleLabel}>Galería</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function RobotAvatar(props: { small?: boolean } = {}): ReactElement {
  return (
    <View style={[styles.robot, props.small && styles.robotSmall]}>
      <CopiRobotIcon size={props.small ? 52 : 76} />
    </View>
  );
}

export function BottomNavigation(props: {
  activeTab: AppTab;
  onOpenShortcut: () => void;
  onSelectTab: (tab: AppTab) => void;
  shortcutActive?: boolean;
  shortcutIcon: IconKind;
  shortcutIsCash?: boolean;
  shortcutLabel: string;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const previewAndroidNav =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('androidNav') === '1';
  const isAndroidTabBar = Platform.OS === 'android' || previewAndroidNav;
  // iOS/web: WhatsApp-style floating pill. Android: Instagram/Facebook edge-to-edge bar.
  // Chrome preview of Android bar: append ?androidNav=1 to the URL.
  const edgeInset = isAndroidTabBar ? 0 : 16;
  const bottomInset = isAndroidTabBar ? Math.max(insets.bottom, 0) : edgeInset;
  const copiActive = props.activeTab === 'copi';

  return (
    <View pointerEvents="box-none" style={styles.bottomNavOverlay}>
      {/* Frosted veil only for floating dock gutters (iOS / web). */}
      {isAndroidTabBar ? null : Platform.OS === 'web' ? (
        <View pointerEvents="none" style={[styles.bottomNavEdgeGlass, styles.bottomNavEdgeGlassFallback]} />
      ) : (
        <BlurView
          blurMethod="dimezisBlurView"
          intensity={55}
          pointerEvents="none"
          style={styles.bottomNavEdgeGlass}
          tint="systemThinMaterialLight"
        />
      )}
      {isAndroidTabBar ? null : <View pointerEvents="none" style={styles.bottomNavEdgeTint} />}
      <View
        style={[
          styles.bottomNavSafe,
          isAndroidTabBar && styles.bottomNavSafeAndroid,
          {
            paddingBottom: bottomInset,
            paddingHorizontal: edgeInset,
          },
        ]}
      >
        <View style={[styles.bottomNav, isAndroidTabBar && styles.bottomNavAndroid]}>
          <TabButton
            active={props.activeTab === 'home' && !props.shortcutActive}
            icon="home"
            label="Inicio"
            onPress={() => props.onSelectTab('home')}
          />
          <TabButton
            active={props.activeTab === 'inbox'}
            icon="inbox"
            label="Chats"
            onPress={() => props.onSelectTab('inbox')}
          />
          <Pressable
            accessibilityLabel="Copi"
            hitSlop={8}
            onPress={() => props.onSelectTab('copi')}
            style={[
              styles.centerAction,
              isAndroidTabBar && styles.centerActionAndroid,
              copiActive && styles.centerActionActive,
              isAndroidTabBar && copiActive && styles.centerActionAndroidActive,
            ]}
          >
            <CopiRobotIcon shadowed size={52} />
          </Pressable>
          <TabButton
            active={Boolean(props.shortcutActive)}
            cashSymbol={props.shortcutIsCash}
            icon={props.shortcutIcon}
            label={props.shortcutLabel}
            onPress={props.onOpenShortcut}
          />
          <TabButton
            active={props.activeTab === 'more' && !props.shortcutActive}
            icon="more"
            label="Más"
            onPress={() => props.onSelectTab('more')}
          />
        </View>
      </View>
    </View>
  );
}

function TabButton(props: {
  active: boolean;
  cashSymbol?: boolean;
  icon: IconKind;
  label: string;
  onPress: () => void;
}): ReactElement {
  const scale = useRef(new Animated.Value(props.active ? 1 : 0.94)).current;
  const glassOpacity = useRef(new Animated.Value(props.active ? 1 : 0)).current;
  const iconColor = props.active ? colors.tabActive : colors.tabInactive;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: props.active ? 1 : 0.94,
        useNativeDriver: true,
        friction: 7,
        tension: 120,
      }),
      Animated.timing(glassOpacity, {
        toValue: props.active ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [glassOpacity, props.active, scale]);

  return (
    <Pressable onPress={props.onPress} style={styles.tabButton}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <View style={styles.tabIconWrap}>
          <Animated.View style={[styles.tabGlassHighlight, { opacity: glassOpacity }]} />
          {props.cashSymbol ? (
            <Text style={[styles.shortcutCashSymbol, { color: iconColor }]}>$</Text>
          ) : (
            <Icon color={iconColor} filled={false} kind={props.icon} size={32} strokeWidth={1.55} />
          )}
        </View>
        <Text style={[styles.tabLabel, props.active && styles.activeTabText]}>{props.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function channelAccentColor(channel: Channel): string {
  return messageSourceMeta(channel).color;
}

function Avatar(props: { channel: Channel; label: string }): ReactElement {
  const accent = channelAccentColor(props.channel);
  return (
    <View style={styles.customerAvatar}>
      <Text style={styles.customerAvatarText}>{props.label}</Text>
      <View style={[styles.channelBadge, { borderColor: accent }]}>
        <ChannelIcon channel={props.channel} size={16} />
      </View>
    </View>
  );
}

function MetricIcon(props: { metricId: string; tone: Tone }): ReactElement {
  const kind: IconKind =
    props.metricId === 'messages'
      ? 'message'
      : props.metricId === 'tasks'
        ? 'bell'
        : props.metricId === 'stock'
          ? 'box'
          : 'money';

  return (
    <View style={styles.metricIconPlain}>
      <Icon color={toneColor(props.tone)} kind={kind} size={26} strokeWidth={1.7} />
    </View>
  );
}

function ToneIcon(props: { tone: Tone }): ReactElement {
  const kind = props.tone === 'red' ? 'alert' : props.tone === 'orange' ? 'bell' : props.tone === 'purple' ? 'bot' : 'money';

  return (
    <View style={[styles.toneIcon, toneBackground(props.tone)]}>
      <Icon color={toneColor(props.tone)} kind={kind} size={16} strokeWidth={1.8} />
    </View>
  );
}

function toneBackground(tone: Tone): object {
  if (tone === 'orange') return styles.orangeTone;
  if (tone === 'red') return styles.redTone;
  if (tone === 'blue') return styles.blueTone;
  if (tone === 'purple') return styles.purpleTone;
  return styles.greenTone;
}

function toneText(tone: Tone): object {
  if (tone === 'orange') return styles.orangeText;
  if (tone === 'red') return styles.redText;
  if (tone === 'blue') return styles.blueText;
  if (tone === 'purple') return styles.purpleText;
  return styles.greenText;
}

function toneColor(tone: Tone): string {
  if (tone === 'orange') return colors.warning;
  if (tone === 'red') return colors.danger;
  if (tone === 'blue') return '#1688e8';
  if (tone === 'purple') return '#8b5cf6';
  return colors.primary;
}

function isChannelSource(source: MessageSource): source is Channel {
  return source === 'email' || source === 'facebook' || source === 'instagram' || source === 'whatsapp';
}

function sourceAccent(source: MessageSource): object {
  return {
    borderLeftColor: messageSourceMeta(source).color,
    borderLeftWidth: 3,
  };
}

function messageSourceMeta(source: MessageSource): { background: string; color: string; label: string } {
  if (source === 'instagram') return { background: '#fff0f7', color: '#e13b8d', label: 'Instagram' };
  if (source === 'facebook') return { background: '#eef5ff', color: '#1877f2', label: 'Facebook' };
  if (source === 'whatsapp') return { background: '#e9f8ef', color: '#08bd66', label: 'WhatsApp' };
  if (source === 'email') return { background: '#eef8ff', color: '#1688e8', label: 'Email' };
  if (source === 'copi') return { background: '#f3eeff', color: '#8b5cf6', label: 'Copi' };
  return { background: '#f1fbf6', color: colors.primary, label: 'Tienda' };
}

const styles = StyleSheet.create({
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  actionIconText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionChevron: {
    color: '#c7c7cc',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
    marginLeft: 4,
  },
  actionContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingRight: 12,
    paddingVertical: 12,
  },
  actionContentDivider: {
    borderBottomColor: colors.separator,
    borderBottomWidth: 1,
  },
  actionIconDisabled: {
    backgroundColor: colors.borderSoft,
  },
  actionIconPlain: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginLeft: 14,
    marginRight: 14,
    width: 30,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  actionRowDisabled: {
    opacity: 0.55,
  },
  actionRowDisabledText: {
    color: colors.textMuted,
  },
  actionTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
  },
  activeBranchRow: {
    backgroundColor: colors.primarySoft,
  },
  activeBranchText: {
    color: colors.primary,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.tabActive,
  },
  addButton: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 32,
  },
  blueText: {
    color: '#1688e8',
  },
  blueTone: {
    backgroundColor: '#eef8ff',
  },
  bottomNavOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 40,
  },
  bottomNavEdgeGlass: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bottomNavEdgeGlassFallback: {
    backgroundColor: 'rgba(251, 252, 251, 0.72)',
  },
  bottomNavEdgeTint: {
    backgroundColor: 'rgba(251, 252, 251, 0.55)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bottomNavSafe: {
    paddingTop: 8,
  },
  bottomNavSafeAndroid: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    paddingTop: 4,
  },
  bottomNav: {
    ...shadows.dock,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.dock,
    borderWidth: 1,
    flexDirection: 'row',
    height: 66,
    justifyContent: 'space-between',
    overflow: 'visible',
    paddingHorizontal: 4,
  },
  bottomNavAndroid: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    elevation: 0,
    height: layout.tabBarHeight,
    overflow: 'visible',
    shadowOpacity: 0,
  },
  tabGlassHighlight: {
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    borderRadius: 18,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tabIconWrap: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 52,
  },
  branchMenu: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 6,
    position: 'absolute',
    right: 20,
    width: 158,
    zIndex: 30,
  },
  branchRow: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flexDirection: 'row',
    height: 36,
    justifyContent: 'space-between',
    paddingHorizontal: 9,
  },
  branchText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '300',
  },
  centerAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 3,
    elevation: 16,
    height: 66,
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: '#101935',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    width: 66,
    zIndex: 2,
  },
  // Android-only: grey ring so Copi reads as a button; size/shadow unchanged.
  centerActionAndroid: {
    borderColor: colors.tabInactive,
    borderWidth: 0.5,
  },
  centerActionAndroidActive: {
    borderColor: colors.tabActive,
  },
  centerActionActive: {
    borderColor: colors.primarySoft,
    shadowOpacity: 0.36,
  },
  centerActionText: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 36,
  },
  shortcutCashSymbol: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },
  channelBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    bottom: -2,
    height: 22,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    right: -2,
    width: 22,
  },
  channelBadgeText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    gap: spacing.boxGap,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  screenScroll: {
    flex: 1,
    minHeight: 0,
  },
  customerAvatar: {
    alignItems: 'center',
    backgroundColor: '#dfaa8b',
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  customerAvatarText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '600',
  },
  dangerIcon: {
    backgroundColor: '#ffeaf0',
  },
  dangerText: {
    color: colors.danger,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flex: 1,
    minWidth: 0,
  },
  greenText: {
    color: colors.primary,
  },
  greenTone: {
    backgroundColor: colors.primarySoft,
  },
  header: {
    backgroundColor: colors.background,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
    position: 'relative',
    zIndex: 20,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    marginLeft: 'auto',
    zIndex: 2,
  },
  headerBrand: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  headerIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    width: 28,
  },
  headerLeading: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    zIndex: 2,
  },
  headerBackPressable: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginLeft: -4,
    minWidth: 40,
  },
  headerBackText: {
    color: colors.navy,
    fontSize: 36,
    lineHeight: 40,
    marginTop: -2,
  },
  headerMain: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 40,
  },
  headerTitle: {
    ...StyleSheet.absoluteFill,
    color: colors.navy,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 40,
    paddingHorizontal: 76,
    textAlign: 'center',
    zIndex: 1,
  },
  leadBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: '300',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  listDescription: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    paddingLeft: 14,
  },
  listRowContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    paddingLeft: 2,
    paddingRight: 14,
    paddingVertical: 10,
  },
  listRowContentDivider: {
    borderBottomColor: colors.separator,
    borderBottomWidth: 1,
  },
  listTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  logo: {
    color: '#0c367f',
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 4.2,
    lineHeight: 34,
  },
  logoTagline: {
    color: '#53607a',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  messageBubble: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 13,
    borderWidth: 1,
    maxWidth: 280,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  messageSourceBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  messageSourceText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  messageText: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
  },
  messageImage: {
    borderRadius: 10,
    height: 220,
    marginBottom: spacing.sm,
    maxWidth: '100%',
    width: 220,
  },
  messageImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: '#e8ecf2',
    borderRadius: 10,
    height: 120,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 220,
  },
  messageImagePlaceholderText: {
    color: colors.slate,
    fontSize: 15,
  },
  messageTime: {
    color: colors.slateLight,
    fontSize: 13,
    marginTop: 2,
    textAlign: 'right',
  },
  linkPreviewCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    gap: 4,
    marginBottom: 6,
    overflow: 'hidden',
    padding: 8,
  },
  linkPreviewDescription: {
    color: colors.slate,
    fontSize: 13,
    lineHeight: 17,
  },
  linkPreviewImage: {
    borderRadius: 8,
    height: 120,
    marginBottom: 4,
    width: '100%',
  },
  linkPreviewTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  linkPreviewUrl: {
    color: colors.slateLight,
    fontSize: 12,
  },
  productLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  messageWrap: {
    alignItems: 'flex-start',
    marginBottom: 13,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingTop: spacing.md,
  },
  metricIconPlain: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    marginBottom: 4,
    width: 32,
  },
  metricItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    width: '50%',
  },
  metricItemLast: {
    borderRightWidth: 0,
  },
  metricLabel: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 2,
    textAlign: 'center',
  },
  micButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  micButtonIdle: {
    backgroundColor: colors.primary,
  },
  micButtonRecording: {
    backgroundColor: colors.danger,
  },
  micButtonText: {
    color: colors.surface,
    fontSize: 15,
  },
  notificationMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  orangeText: {
    color: colors.warning,
  },
  orangeTone: {
    backgroundColor: colors.warningSoft,
  },
  outboundMessageBubble: {
    backgroundColor: '#dcffd9',
    borderWidth: 0,
  },
  outboundMessageWrap: {
    alignItems: 'flex-end',
  },
  ownerAvatar: {
    alignItems: 'center',
    backgroundColor: '#f0d4c8',
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 30,
  },
  ownerAvatarImage: {
    height: 30,
    width: 30,
  },
  ownerHair: {
    backgroundColor: '#8d4c32',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    height: 23,
    width: 18,
  },
  primaryText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  profileAvatar: {
    backgroundColor: '#dfaa8b',
    borderRadius: radius.pill,
    height: 78,
    width: 78,
  },
  profileCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    minHeight: 128,
    padding: 18,
  },
  profileLine: {
    color: colors.slate,
    fontSize: 13,
    marginTop: 8,
  },
  profileName: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  purpleText: {
    color: '#8b5cf6',
  },
  purpleTone: {
    backgroundColor: '#f2eaff',
  },
  quickAction: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    height: 31,
    justifyContent: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  redText: {
    color: colors.danger,
  },
  redTone: {
    backgroundColor: '#ffeaf0',
  },
  replyBar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  replyBarEmbedded: {
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  replyBarWrap: {
    backgroundColor: colors.background,
  },
  replyBarWrapEmbedded: {
    backgroundColor: 'transparent',
  },
  attachmentCircle: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  attachmentCircleCamera: {
    backgroundColor: '#e05c84',
  },
  attachmentCircleGallery: {
    backgroundColor: '#8f66d8',
  },
  attachmentCircleLabel: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  attachmentCircleOption: {
    alignItems: 'center',
    minWidth: 76,
  },
  attachmentBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 25, 53, 0.35)',
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  attachmentModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  attachmentSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
  },
  attachmentSheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.borderInput,
    borderRadius: 999,
    height: 4,
    marginBottom: spacing.md,
    width: 40,
  },
  attachmentSheetTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
  },
  pendingImageClear: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  pendingImageLabel: {
    color: colors.slate,
    flex: 1,
    fontSize: 15,
    lineHeight: 16,
  },
  pendingImageRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.xl,
    padding: spacing.sm,
  },
  pendingImageThumb: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
  recordingHint: {
    color: colors.slate,
    fontSize: 13,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xl,
    textAlign: 'center',
  },
  robot: {
    alignItems: 'center',
    height: 76,
    justifyContent: 'center',
    position: 'relative',
    width: 82,
  },
  robotSmall: {
    height: 48,
    width: 54,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 9,
    width: 42,
  },
  screenTitle: typography.title,
  sectionHeaderPad: {
    paddingHorizontal: 4,
  },
  storeButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 24,
  },
  subheading: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'visible',
    zIndex: 1,
  },
  tabIcon: {
    color: colors.tabInactive,
    fontSize: 20,
    fontWeight: '300',
  },
  tabLabel: {
    color: colors.tabInactive,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  threadHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    height: 74,
    paddingHorizontal: spacing.lg,
  },
  timestamp: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '300',
  },
  toneIcon: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  toneIconText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 17,
    paddingHorizontal: 5,
    textAlign: 'center',
  },
  unreadDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 5,
    position: 'absolute',
    right: 1,
    top: -2,
    width: 5,
  },
});
