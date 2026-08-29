import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { showPermissionDeniedAlert } from '../lib/androidPermissions';
import { guessAudioMimeType, readAudioAsBase64 } from '../lib/copiAudio';
import { readImageAssetAsBase64 } from '../lib/readImageAssetAsBase64';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useAndroidKeyboardHeight } from '../hooks/useAndroidKeyboard';

import { MobileContainedModal } from '../components/MobileContainedModal';
import { SwipeableChatRow } from '../components/SwipeableChatRow';

import type { Channel } from '../api/mockData';
import {
  archiveConversation,
  clearConversationMessages,
  deleteConversation,
  markConversationUnread,
  unarchiveConversation,
} from '../api/conversationActions';
import {
  Card,
  ConversationRow,
  MessageBubble,
  ReplyComposer,
  ScreenContent,
  ScreenTitle,
  useHeaderCollapseOnScroll,
} from '../components/ui';
import { getBottomNavClearance, InfoBanner, PrimaryButton, SearchActionRow } from '../design-system';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { useHeaderScreenOptions } from '../hooks/useHeaderScreenOptions';
import {
  defaultInboxFilters,
  filterInboxConversations,
  type InboxChannelFilter,
  type InboxListFilters,
  type InboxStatusFilter,
} from '../lib/inboxFilters';
import {
  conversationAvatarLabel,
  conversationDisplayName,
  conversationPreview,
  formatConversationTime,
  leadStatusLabel,
  messageBubbleText,
  messageBubbleTime,
} from '../lib/inboxPresentation';
import type { OwnerDashboard } from '../types/dashboard';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';
import { colors } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CHANNEL_OPTIONS: Array<{ id: InboxChannelFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'email', label: 'Email' },
];

const STATUS_OPTIONS: Array<{ id: InboxStatusFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'new', label: 'Nuevo' },
  { id: 'opportunity', label: 'Oportunidad' },
  { id: 'open', label: 'Abierto' },
  { id: 'archived', label: 'Archivado' },
];

export function InboxScreen(props: {
  conversations: InboxConversationSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  onOpenConversation: (conversationId: string) => void;
  onOpenWhatsAppSetup: () => void;
  onReload?: () => Promise<void> | void;
  whatsappConnection: OwnerDashboard['whatsappConnection'] | null;
}): ReactElement {
  const [filters, setFilters] = useState<InboxListFilters>(defaultInboxFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const connection = props.whatsappConnection ?? {
    status: 'not_configured' as const,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedAt: null,
    lastStatusCheckAt: null,
    lastError: null,
  };
  const connectionCopy = whatsappConnectionLabel(connection);
  const filteredConversations = useMemo(
    () => filterInboxConversations(props.conversations, filters),
    [filters, props.conversations],
  );
  const setHeaderCollapsedFromScroll = useHeaderCollapseOnScroll();
  const insets = useSafeAreaInsets();
  const bottomClearance = getBottomNavClearance(insets.bottom);

  const runAction = useCallback(
    async (action: () => Promise<void>, errorTitle: string): Promise<void> => {
      try {
        await action();
        await props.onReload?.();
      } catch (error) {
        Alert.alert(errorTitle, error instanceof Error ? error.message : 'Error desconocido');
      }
    },
    [props],
  );

  function openConversationMenu(conversation: InboxConversationSummary): void {
    const archived = Boolean(conversation.archivedAt || conversation.status === 'closed');
    Alert.alert(conversationDisplayName(conversation), undefined, [
      {
        text: 'Marcar como no leído',
        onPress: () => {
          void runAction(() => markConversationUnread(conversation.id), 'No se pudo marcar');
        },
      },
      {
        text: archived ? 'Desarchivar' : 'Archivar',
        onPress: () => {
          void runAction(
            () =>
              archived
                ? unarchiveConversation(conversation.id)
                : archiveConversation(conversation.id),
            'No se pudo archivar',
          );
        },
      },
      {
        text: 'Vaciar chat',
        onPress: () => {
          Alert.alert(
            'Vaciar chat',
            'Se van a ocultar los mensajes de este chat para tu negocio. El chat sigue abierto.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Vaciar',
                style: 'destructive',
                onPress: () => {
                  void runAction(
                    () => clearConversationMessages(conversation.id),
                    'No se pudo vaciar',
                  );
                },
              },
            ],
          );
        },
      },
      {
        text: 'Eliminar chat',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Eliminar chat',
            'El chat se oculta de todos los filtros para tu negocio. No borra el historial del cliente en WhatsApp.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: () => {
                  void runAction(() => deleteConversation(conversation.id), 'No se pudo eliminar');
                },
              },
            ],
          );
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <ScreenContent disableScroll title="Chats">
      <FlatList
        contentContainerStyle={[styles.inboxListContent, { paddingBottom: bottomClearance }]}
        data={props.isLoading ? [] : filteredConversations}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          props.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : props.errorMessage ? (
            <Text style={styles.errorText}>{props.errorMessage}</Text>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No hay conversaciones</Text>
              <Text style={styles.emptyBody}>
                {filters.query || filters.channel !== 'all' || filters.status !== 'all'
                  ? 'Probá con otro término de búsqueda o filtro.'
                  : 'Cuando un cliente escriba por WhatsApp, Instagram u otro canal, la conversación va a aparecer acá.'}
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.inboxListHeader}>
            <ScreenTitle title="Chats" />

            {connection.status === 'connected' && connection.displayPhoneNumber ? (
              <InfoBanner>{`Respondiendo desde ${connection.displayPhoneNumber}`}</InfoBanner>
            ) : null}

            {connection.status !== 'connected' ? (
              <View style={styles.setupBlock}>
                <InfoBanner>{`${connectionCopy.title}\n${connectionCopy.subtitle}`}</InfoBanner>
                <PrimaryButton
                  fullWidth
                  label="Configurar WhatsApp"
                  onPress={props.onOpenWhatsAppSetup}
                />
              </View>
            ) : null}

            <FeatureGate feature="inboxSearch">
              <SearchActionRow
                onChangeText={(query) => setFilters((current) => ({ ...current, query }))}
                onPressFilter={() => setFiltersOpen(true)}
                placeholder="Buscar conversaciones"
                searchValue={filters.query}
                showFilter
              />
            </FeatureGate>
          </View>
        }
        renderItem={({ item: conversation, index }) => {
          const archived = Boolean(conversation.archivedAt || conversation.status === 'closed');
          return (
            <SwipeableChatRow
              archived={archived}
              onArchive={() => {
                void runAction(() => archiveConversation(conversation.id), 'No se pudo archivar');
              }}
              onLongPress={() => openConversationMenu(conversation)}
              onMore={() => openConversationMenu(conversation)}
              onUnarchive={() => {
                void runAction(
                  () => unarchiveConversation(conversation.id),
                  'No se pudo desarchivar',
                );
              }}
              onUnread={() => {
                void runAction(
                  () => markConversationUnread(conversation.id),
                  'No se pudo marcar',
                );
              }}
            >
              <ConversationRow
                avatar={conversationAvatarLabel(conversation)}
                channel={conversation.channel as Channel}
                name={conversationDisplayName(conversation)}
                onPress={() => props.onOpenConversation(conversation.id)}
                preview={conversationPreview(conversation)}
                showDivider={index < filteredConversations.length - 1}
                statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
                time={formatConversationTime(conversation.lastMessageAt)}
                unreadCount={conversation.unreadCount || undefined}
              />
            </SwipeableChatRow>
          );
        }}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          setHeaderCollapsedFromScroll(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.inboxList}
      />

      <InboxFilterModal
        filters={filters}
        onApply={setFilters}
        onClose={() => setFiltersOpen(false)}
        visible={filtersOpen}
      />
    </ScreenContent>
  );
}

function InboxFilterModal(props: {
  filters: InboxListFilters;
  onApply: (filters: InboxListFilters) => void;
  onClose: () => void;
  visible: boolean;
}): ReactElement {
  const [draft, setDraft] = useState<InboxListFilters>(props.filters);

  useEffect(() => {
    if (props.visible) {
      setDraft(props.filters);
    }
  }, [props.filters, props.visible]);

  return (
    <MobileContainedModal animationType="slide" onClose={props.onClose} visible={props.visible}>
      <Text style={styles.modalTitle}>Filtrar conversaciones</Text>

          <Text style={styles.modalSection}>Canal</Text>
          <View style={styles.chipRow}>
            {CHANNEL_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setDraft((current) => ({ ...current, channel: option.id }))}
                style={[styles.chip, draft.channel === option.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, draft.channel === option.id && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.modalSection}>Estado</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setDraft((current) => ({ ...current, status: option.id }))}
                style={[styles.chip, draft.status === option.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, draft.status === option.id && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modalActions}>
            <PrimaryButton
              label="Limpiar"
              onPress={() => {
                setDraft(defaultInboxFilters);
                props.onApply(defaultInboxFilters);
                props.onClose();
              }}
            />
            <PrimaryButton
              label="Aplicar"
              onPress={() => {
                props.onApply({ ...draft, query: props.filters.query });
                props.onClose();
              }}
            />
          </View>
    </MobileContainedModal>
  );
}

export function ConversationDetailScreen(props: {
  channel?: Channel;
  composerBlockedMessage?: string | null;
  customerName: string;
  displayPhoneNumber?: string | null;
  isLoading: boolean;
  messages: WhatsAppMessagePreview[];
  onAddDeviceContact?: () => void;
  onBack: () => void;
  onMessageLongPress?: (message: WhatsAppMessagePreview) => void;
  onSendAudio?: (params: {
    audioBase64: string;
    durationMs?: number;
    mimeType?: string;
  }) => Promise<void>;
  onSendImage?: (params: {
    caption?: string;
    imageBase64: string;
    mimeType?: string;
  }) => Promise<void>;
  onSendReply?: (body: string) => Promise<void>;
  phoneNumber?: string | null;
  replySeed?: string | null;
  showAddContact?: boolean;
  statusLabel?: string;
  threadAvatar?: string;
}): ReactElement {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    uri: string;
  } | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const messagesScrollRef = useRef<ScrollView>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const androidKeyboardHeight = useAndroidKeyboardHeight();
  useHeaderScreenOptions({
    forceCollapsed: true,
    onBack: props.onBack,
    title: props.customerName || props.displayPhoneNumber || 'Chat',
  });

  useEffect(() => {
    if (!props.replySeed) {
      return;
    }
    const separator = props.replySeed.indexOf('|');
    const quote =
      separator >= 0 ? props.replySeed.slice(separator + 1) : props.replySeed;
    if (!quote.trim()) {
      return;
    }
    setDraft((current) => {
      const prefix = `> ${quote}\n\n`;
      return current.startsWith(prefix) ? current : `${prefix}${current}`;
    });
  }, [props.replySeed]);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      messagesScrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [props.messages, pendingImage, stickToBottom]);

  useAndroidBackHandler(attachmentMenuOpen, () => {
    setAttachmentMenuOpen(false);
    return true;
  });

  const stagePickedAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.uri) {
      return;
    }
    try {
      const { base64, mimeType } = await readImageAssetAsBase64(asset);
      setPendingImage({
        base64,
        mimeType,
        uri: asset.uri,
      });
    } catch (error) {
      Alert.alert(
        'Foto',
        error instanceof Error ? error.message : 'No se pudo cargar la imagen.',
      );
    }
  }, []);

  const onPressAttachCamera = useCallback(async () => {
    setAttachmentMenuOpen(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showPermissionDeniedAlert('camera', { canAskAgain: permission.canAskAgain !== false });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: true,
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await stagePickedAsset(result.assets[0]);
    }
  }, [stagePickedAsset]);

  const onPressAttachLibrary = useCallback(async () => {
    setAttachmentMenuOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showPermissionDeniedAlert('photos', { canAskAgain: permission.canAskAgain !== false });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: true,
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await stagePickedAsset(result.assets[0]);
    }
  }, [stagePickedAsset]);

  async function handleSend(): Promise<void> {
    if (isSending) {
      return;
    }

    const caption = draft.trim();
    if (pendingImage) {
      if (!props.onSendImage) {
        return;
      }
      setIsSending(true);
      setSendError(null);
      try {
        await props.onSendImage({
          caption: caption || undefined,
          imageBase64: pendingImage.base64,
          mimeType: pendingImage.mimeType,
        });
        setPendingImage(null);
        setDraft('');
      } catch (error) {
        setSendError(error instanceof Error ? error.message : 'No se pudo enviar la imagen.');
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (!props.onSendReply || !caption) {
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      await props.onSendReply(caption);
      setDraft('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  }

  const handleVoicePress = useCallback(async (): Promise<void> => {
    if (props.composerBlockedMessage || !props.onSendAudio) {
      return;
    }

    if (isRecordingVoice || recorderState.isRecording) {
      try {
        await audioRecorder.stop();
        setIsRecordingVoice(false);
        const uri = audioRecorder.uri;
        if (!uri) {
          throw new Error('No se pudo leer la nota de voz.');
        }
        const recorded = await readAudioAsBase64(uri);
        const durationMs = recordingStartedAt
          ? Math.max(500, Date.now() - recordingStartedAt)
          : undefined;
        setRecordingStartedAt(null);
        setIsSending(true);
        setSendError(null);
        await props.onSendAudio({
          audioBase64: recorded.base64,
          durationMs,
          mimeType: recorded.mimeType || guessAudioMimeType(uri),
        });
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : 'No se pudo enviar la nota de voz.',
        );
      } finally {
        setIsSending(false);
        setIsRecordingVoice(false);
        setRecordingStartedAt(null);
      }
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showPermissionDeniedAlert('microphone', {
          canAskAgain: permission.canAskAgain !== false,
        });
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingStartedAt(Date.now());
      setIsRecordingVoice(true);
      setSendError(null);
    } catch (error) {
      setIsRecordingVoice(false);
      setRecordingStartedAt(null);
      Alert.alert(
        'Micrófono',
        error instanceof Error ? error.message : 'No se pudo iniciar la grabación.',
      );
    }
  }, [
    audioRecorder,
    isRecordingVoice,
    props,
    recorderState.isRecording,
    recordingStartedAt,
  ]);

  const canSend = Boolean(
    (pendingImage && props.onSendImage) || (draft.trim() && props.onSendReply),
  );

  function handleMessagesScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setStickToBottom(distanceFromBottom < 48);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.detailRoot,
        Platform.OS === 'android' && androidKeyboardHeight > 0
          ? { paddingBottom: androidKeyboardHeight }
          : null,
      ]}
    >
      <View style={styles.chatToolbar}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.chatBackButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        {props.statusLabel ? <Text style={styles.leadBadge}>{props.statusLabel}</Text> : null}
        {props.showAddContact && props.onAddDeviceContact ? (
          <Pressable hitSlop={8} onPress={props.onAddDeviceContact} style={styles.addContactButton}>
            <Text style={styles.addContactText}>Agregar contacto</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.detailBody}>
        <FeatureGate feature="chatMessages">
          <ScrollView
            ref={messagesScrollRef}
            contentContainerStyle={styles.chatAreaContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              if (stickToBottom) {
                messagesScrollRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onScroll={handleMessagesScroll}
            scrollEventThrottle={16}
            style={styles.chatArea}
          >
            {props.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
            {!props.isLoading && props.messages.length === 0 ? (
              <Text style={styles.emptyBody}>Todavía no hay mensajes en este hilo.</Text>
            ) : null}
            {props.messages.map((message) => (
              <MessageBubble
                direction={message.direction === 'outbound' ? 'outbound' : 'inbound'}
                editedAt={message.editedAt}
                key={message.id}
                linkPreview={message.linkPreview}
                mediaMimeType={message.mediaMimeType}
                mediaStoragePath={message.mediaStoragePath}
                mediaUrl={message.mediaUrl}
                messageType={message.messageType}
                onLongPress={() => props.onMessageLongPress?.(message)}
                text={messageBubbleText(message)}
                time={messageBubbleTime(message)}
              />
            ))}
          </ScrollView>
        </FeatureGate>
      </View>
      <FeatureGate feature="chatComposer">
        {sendError ? <Text style={styles.sendErrorText}>{sendError}</Text> : null}
        {props.composerBlockedMessage ? (
          <Text style={styles.windowBlockedText}>{props.composerBlockedMessage}</Text>
        ) : null}
        <ReplyComposer
          attachmentMenuOpen={attachmentMenuOpen}
          canUseVoice={Boolean(props.onSendAudio && !props.composerBlockedMessage)}
          editable={!props.composerBlockedMessage}
          isRecordingVoice={isRecordingVoice || recorderState.isRecording}
          isSending={isSending}
          onChangeText={setDraft}
          onClearPendingImage={() => setPendingImage(null)}
          onPressAttachCamera={
            props.composerBlockedMessage
              ? undefined
              : () => {
                  void onPressAttachCamera();
                }
          }
          onPressAttachLibrary={
            props.composerBlockedMessage
              ? undefined
              : () => {
                  void onPressAttachLibrary();
                }
          }
          onPressPlus={
            props.composerBlockedMessage
              ? undefined
              : () => {
                  setAttachmentMenuOpen((open) => !open);
                }
          }
          onPressVoice={
            props.onSendAudio && !props.composerBlockedMessage
              ? () => {
                  void handleVoicePress();
                }
              : undefined
          }
          onSend={canSend && !props.composerBlockedMessage ? handleSend : undefined}
          pendingImageHint="Foto lista. Escribí un texto (opcional) y enviá."
          pendingImageUri={pendingImage?.uri ?? null}
          placeholder={
            props.composerBlockedMessage
              ? 'Respuesta no disponible'
              : isRecordingVoice
                ? 'Grabando nota de voz…'
                : 'Escribi un mensaje...'
          }
          value={draft}
          voiceMode="voice-note"
        />
      </FeatureGate>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  inboxList: {
    flex: 1,
  },
  inboxListContent: {
    paddingHorizontal: 16,
  },
  inboxListHeader: {
    gap: 12,
    marginBottom: 8,
  },
  activeStatusTab: {
    borderBottomColor: colors.primary,
    borderBottomWidth: 2,
    color: colors.primary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    paddingBottom: 10,
    textAlign: 'center',
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    paddingHorizontal: 14,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  channelBadgePill: {
    backgroundColor: colors.badgeGreenBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  businessNumberText: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '500',
  },
  channelTagText: {
    color: '#1877f2',
    fontSize: 12,
    fontWeight: '600',
  },
  chatArea: {
    backgroundColor: '#efeae2',
    flex: 1,
    minHeight: 0,
  },
  chatAreaContent: {
    flexGrow: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  chatBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  chatToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addContactButton: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addContactText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  chip: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipText: {
    color: colors.slate,
    fontSize: 15,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  detailBody: {
    flex: 1,
    minHeight: 0,
  },
  detailRoot: {
    backgroundColor: '#efeae2',
    flex: 1,
    minHeight: 0,
  },
  emptyBody: {
    color: colors.slate,
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyState: {
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  leadBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSection: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 28,
  },
  modalTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  setupBlock: {
    gap: 12,
    marginBottom: 12,
  },
  sendErrorText: {
    color: colors.danger,
    fontSize: 15,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  windowBlockedText: {
    color: colors.slate,
    fontSize: 15,
    lineHeight: 16,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  statusTab: {
    color: colors.slate,
    flex: 1,
    fontSize: 13,
    fontWeight: '300',
    paddingBottom: 10,
    textAlign: 'center',
  },
  statusTabs: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingTop: 12,
  },
  threadAvatar: {
    alignItems: 'center',
    backgroundColor: '#dfaa8b',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  threadAvatarText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },
  threadHeader: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 86,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  threadName: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  threadTags: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
});
