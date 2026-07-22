import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Channel, DashboardMetricMock, NotificationMock, Tone } from '../api/mockData';
import {
  Card as DsCard,
  ComposerInput,
  SectionHeader as DsSectionHeader,
  StatusDot,
  colors,
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

export function AppHeader(props: {
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const chrome = useHeaderChromeOptional();
  const profile = useProfileChromeOptional();
  const showCollapsed = chrome.collapseEnabled && chrome.collapsed;

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
      <View style={styles.headerMain}>
        {showCollapsed ? (
          <>
            <View style={styles.headerLeading}>
              <NexoliaMark size={32} />
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
          <Pressable onPress={props.onOpenNotifications} style={styles.headerIcon}>
            <Icon kind="bell" size={18} strokeWidth={1.7} />
            <View style={styles.unreadDot} />
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
  title?: string;
}): ReactElement {
  const chrome = useHeaderChromeOptional();
  const collapseHeaderOnScroll = props.collapseHeaderOnScroll !== false;

  useEffect(() => {
    if (!collapseHeaderOnScroll) {
      chrome.setChrome({ collapseEnabled: false, collapsed: false, title: null });
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
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

export function ScreenTitle(props: { subtitle?: string; title: string }): ReactElement {
  const chrome = useHeaderChromeOptional();

  useEffect(() => {
    chrome.setChrome({ collapseEnabled: true, title: props.title });
  }, [chrome.setChrome, props.title]);

  return (
    <View>
      <Text style={styles.screenTitle}>{props.title}</Text>
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
      {props.metrics.map((metric, index) => {
        const content = (
          <>
            <MetricIcon metricId={metric.id} tone={metric.tone} />
            <Text numberOfLines={1} style={[styles.metricValue, toneText(metric.tone)]}>
              {metric.value}
            </Text>
            <Text numberOfLines={2} style={styles.metricLabel}>
              {metric.label}
            </Text>
          </>
        );

        if (props.onMetricPress) {
          return (
            <Pressable
              accessibilityRole="button"
              key={metric.id}
              onPress={() => props.onMetricPress?.(metric.id)}
              style={[styles.metricItem, index === props.metrics.length - 1 && styles.metricItemLast]}
            >
              {content}
            </Pressable>
          );
        }

        return (
          <View
            key={metric.id}
            style={[styles.metricItem, index === props.metrics.length - 1 && styles.metricItemLast]}
          >
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
  statusLabel?: string;
  time: string;
  unreadCount?: number;
}): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.listRow}>
      <Avatar channel={props.channel} label={props.avatar} />
      <View style={styles.flexShrink}>
        <Text numberOfLines={1} style={styles.listTitle}>{props.name}</Text>
        <Text numberOfLines={1} style={styles.listDescription}>{props.preview}</Text>
        {props.statusLabel ? <Text numberOfLines={1} style={styles.leadBadge}>{props.statusLabel}</Text> : null}
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.timestamp}>{props.time}</Text>
        {props.unreadCount ? <Text style={styles.unreadBadge}>{props.unreadCount}</Text> : null}
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
}): ReactElement {
  const content = (
    <>
      <ToneIcon tone={props.notification.tone} />
      <View style={styles.flex}>
        <Text style={styles.listTitle}>{props.notification.title}</Text>
        {props.notification.subtitle ? (
          <Text numberOfLines={1} style={styles.listDescription}>{props.notification.subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.notificationMeta}>
        <Text style={styles.timestamp}>{props.notification.time}</Text>
        {props.notification.unread ? <StatusDot /> : null}
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
  icon?: IconKind;
  onPress?: () => void;
  subtitle?: string;
  title: string;
}): ReactElement {
  const isDisabled = props.disabled === true || props.onPress == null;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={props.onPress}
      style={[styles.actionRow, isDisabled && styles.actionRowDisabled]}
    >
      <View style={[styles.actionIcon, props.danger && styles.dangerIcon, isDisabled && styles.actionIconDisabled]}>
        <ActionIcon
          color={isDisabled ? colors.textMuted : props.danger ? colors.danger : colors.primary}
          kind={props.icon ?? 'message'}
        />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.listTitle, props.danger && styles.dangerText, isDisabled && styles.actionRowDisabledText]}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text numberOfLines={1} style={[styles.listDescription, isDisabled && styles.actionRowDisabledText]}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {isDisabled ? null : <Text style={styles.primaryText}>›</Text>}
    </Pressable>
  );
}

function ActionIcon(props: { color: string; kind: IconKind }): ReactElement {
  if (props.kind === 'whatsapp' || props.kind === 'instagram' || props.kind === 'facebook' || props.kind === 'email') {
    return <ChannelIcon channel={props.kind} size={18} />;
  }

  return <Icon color={props.color} kind={props.kind} size={18} strokeWidth={1.85} />;
}

export function MessageBubble(props: {
  direction: 'inbound' | 'outbound';
  mediaStoragePath?: string | null;
  mediaUrl?: string | null;
  onPressProduct?: (productId: string) => void;
  source?: MessageSource;
  text: string;
  time: string;
}): ReactElement {
  const outbound = props.direction === 'outbound';
  const showCopiTag = props.source === 'copi';
  const parts = parseCopiRichText(props.text);
  const hasText = Boolean(props.text.trim());
  const hasImage = Boolean(props.mediaUrl || props.mediaStoragePath);

  return (
    <View style={[styles.messageWrap, outbound && styles.outboundMessageWrap]}>
      <View style={[styles.messageBubble, outbound && styles.outboundMessageBubble]}>
        {showCopiTag ? <MessageSourceBadge source="copi" /> : null}
        {hasImage ? (
          <MessageBubbleImage
            mediaStoragePath={props.mediaStoragePath}
            mediaUrl={props.mediaUrl}
          />
        ) : null}
        {hasText ? (
          <Text style={styles.messageText}>
            {parts.map((part, index) => {
              if (part.type === 'text') {
                return <Text key={`t-${index}`}>{part.value}</Text>;
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
        <Text style={styles.messageTime}>{props.time}</Text>
      </View>
    </View>
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
}): ReactElement {
  const hasText = Boolean(props.value?.trim());
  const hasPendingImage = Boolean(props.pendingImageUri);
  const busy = props.isSending || props.isTranscribingVoice || props.isAnalyzingImage;
  const canSend = Boolean(props.onSend && (hasText || hasPendingImage) && !busy);
  const showVoice = Boolean(props.canUseVoice && !hasText && !hasPendingImage && props.onPressVoice);
  const showAttachmentSheet = Boolean(
    props.attachmentMenuOpen && (props.onPressAttachCamera || props.onPressAttachLibrary),
  );
  const insets = useSafeAreaInsets();

  function closeAttachmentSheet(): void {
    if (props.attachmentMenuOpen && props.onPressPlus) {
      props.onPressPlus();
    }
  }

  return (
    <View style={[styles.replyBarWrap, props.embedded && styles.replyBarWrapEmbedded]}>
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
              disabled={busy && !showVoice}
              onPress={showVoice ? props.onPressVoice : props.onSend}
              style={[
                styles.micButton,
                props.isRecordingVoice && styles.micButtonRecording,
                showVoice && !props.isRecordingVoice && styles.micButtonIdle,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : props.isRecordingVoice ? (
                <Icon color={colors.surface} kind="mic" size={19} strokeWidth={2.2} />
              ) : (
                <Icon
                  color={colors.surface}
                  kind={canSend ? 'message' : 'mic'}
                  size={19}
                  strokeWidth={2.2}
                />
              )}
            </Pressable>
          }
        />
      </View>
      {props.isRecordingVoice ? (
        <Text style={styles.recordingHint}>Grabando… tocá el micrófono para terminar.</Text>
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
  onOpenSell: () => void;
  onSelectTab: (tab: AppTab) => void;
}): ReactElement {
  return (
    <View style={styles.bottomNav}>
      <TabButton active={props.activeTab === 'home'} icon="home" label="Inicio" onPress={() => props.onSelectTab('home')} />
      <TabButton active={props.activeTab === 'inbox'} icon="inbox" label="Inbox" onPress={() => props.onSelectTab('inbox')} />
      <Pressable onPress={props.onOpenSell} style={styles.centerAction}>
        <Text style={styles.centerActionText}>$</Text>
      </Pressable>
      <TabButton active={props.activeTab === 'copi'} icon="bot" label="Copi" onPress={() => props.onSelectTab('copi')} />
      <TabButton active={props.activeTab === 'more'} icon="more" label="Más" onPress={() => props.onSelectTab('more')} />
    </View>
  );
}

function TabButton(props: { active: boolean; icon: IconKind; label: string; onPress: () => void }): ReactElement {
  const useFilled = props.active && (props.icon === 'home' || props.icon === 'inbox' || props.icon === 'bot');

  return (
    <Pressable onPress={props.onPress} style={styles.tabButton}>
      <Icon
        color={props.active ? colors.primary : '#53607a'}
        filled={useFilled}
        kind={props.icon}
        size={22}
        strokeWidth={1.9}
      />
      <Text style={[styles.tabLabel, props.active && styles.activeTabText]}>{props.label}</Text>
    </Pressable>
  );
}

function Avatar(props: { channel: Channel; label: string }): ReactElement {
  return (
    <View style={styles.customerAvatar}>
      <Text style={styles.customerAvatarText}>{props.label}</Text>
      <View style={styles.channelBadge}>
        <ChannelIcon channel={props.channel} size={12} />
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
    <View style={[styles.toneIcon, toneBackground(props.tone)]}>
      <Icon color={toneColor(props.tone)} kind={kind} size={18} strokeWidth={1.8} />
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
  actionIconDisabled: {
    backgroundColor: colors.borderSoft,
  },
  actionRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeBranchRow: {
    backgroundColor: colors.primarySoft,
  },
  activeBranchText: {
    color: colors.primary,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.primary,
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
  bottomNav: {
    ...shadows.dock,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
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
    fontSize: 10,
    fontWeight: '300',
  },
  centerAction: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 6,
    height: 63,
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: 63,
  },
  centerActionText: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 36,
  },
  channelBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    bottom: -3,
    height: 19,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    width: 19,
  },
  channelBadgeText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: '600',
  },
  chevron: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    gap: spacing.boxGap,
    paddingBottom: spacing.lg,
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
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  customerAvatarText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '600',
  },
  actionRowDisabled: {
    opacity: 0.55,
  },
  actionRowDisabledText: {
    color: colors.textMuted,
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
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    width: 24,
  },
  headerLeading: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    zIndex: 2,
  },
  headerMain: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 40,
  },
  headerTitle: {
    ...StyleSheet.absoluteFill,
    color: colors.navy,
    fontSize: 15,
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
    fontSize: 9,
    fontWeight: '300',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  listDescription: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    lineHeight: 13,
  },
  listRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
  },
  listTitle: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  logo: {
    color: '#0c367f',
    fontSize: 23,
    fontWeight: '300',
    letterSpacing: 5.1,
    lineHeight: 24,
  },
  logoTagline: {
    color: '#53607a',
    fontSize: 11,
    fontWeight: '300',
    marginTop: 3,
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
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 11,
  },
  messageText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '300',
    lineHeight: 18,
  },
  messageImage: {
    borderRadius: 10,
    height: 220,
    marginBottom: spacing.sm,
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
    fontSize: 12,
  },
  messageTime: {
    color: colors.slateLight,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
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
    paddingTop: spacing.lg,
  },
  metricItem: {
    alignItems: 'center',
    borderRightColor: colors.borderSoft,
    borderRightWidth: 1,
    flex: 1,
    minHeight: 72,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  metricItemLast: {
    borderRightWidth: 0,
  },
  metricLabel: {
    color: colors.slate,
    fontSize: 8,
    fontWeight: '300',
    lineHeight: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 6,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 10,
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
    fontSize: 10,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
  },
  pendingImageLabel: {
    color: colors.slate,
    flex: 1,
    fontSize: 12,
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
    fontSize: 10,
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
    fontSize: 11,
    fontWeight: '300',
    lineHeight: 14,
    marginTop: 7,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
  },
  tabIcon: {
    color: colors.slateLight,
    fontSize: 20,
    fontWeight: '300',
  },
  tabLabel: {
    color: colors.slateLight,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
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
    fontSize: 10,
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
    fontSize: 10,
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
