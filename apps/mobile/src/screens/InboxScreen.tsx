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

import { showPermissionDeniedAlert } from '../lib/androidPermissions';
import { readImageAssetAsBase64 } from '../lib/readImageAssetAsBase64';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';

import { MobileContainedModal } from '../components/MobileContainedModal';

import type { Channel } from '../api/mockData';
import {
  Card,
  ConversationRow,
  MessageBubble,
  ReplyComposer,
  ScreenContent,
  ScreenTitle,
} from '../components/ui';
import { InfoBanner, PrimaryButton, SearchActionRow } from '../design-system';
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
  openConversationCount,
} from '../lib/inboxPresentation';
import type { OwnerDashboard } from '../types/dashboard';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';
import { colors } from '../theme';

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
  { id: 'open', label: 'Abierto' },
  { id: 'archived', label: 'Archivado' },
];

export function InboxScreen(props: {
  conversations: InboxConversationSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  onOpenConversation: (conversationId: string) => void;
  onOpenWhatsAppSetup: () => void;
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
  const openCount = openConversationCount(props.conversations);

  return (
    <ScreenContent disableScroll title="Inbox">
      <FlatList
        contentContainerStyle={styles.inboxListContent}
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
            <ScreenTitle subtitle="Todas tus conversaciones en un solo lugar" title="Inbox" />

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

            <FeatureGate feature="inboxTabs">
              <View style={styles.statusTabs}>
                <Text style={styles.activeStatusTab}>Abiertos {openCount}</Text>
                <Text style={styles.statusTab}>
                  {filters.channel === 'all' ? 'Todos los canales' : filters.channel}
                </Text>
              </View>
            </FeatureGate>
          </View>
        }
        renderItem={({ item: conversation }) => (
          <ConversationRow
            avatar={conversationAvatarLabel(conversation)}
            channel={conversation.channel as Channel}
            name={conversationDisplayName(conversation)}
            onPress={() => props.onOpenConversation(conversation.id)}
            preview={conversationPreview(conversation)}
            statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
            time={formatConversationTime(conversation.lastMessageAt)}
          />
        )}
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
  onBack: () => void;
  onSendImage?: (params: {
    caption?: string;
    imageBase64: string;
    mimeType?: string;
  }) => Promise<void>;
  onSendReply?: (body: string) => Promise<void>;
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
  const messagesScrollRef = useRef<ScrollView>(null);
  useHeaderScreenOptions({
    forceCollapsed: true,
    title: props.customerName || props.displayPhoneNumber || 'Chat',
  });

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.detailRoot}
    >
      <View style={styles.chatToolbar}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.chatBackButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        {props.statusLabel ? <Text style={styles.leadBadge}>{props.statusLabel}</Text> : null}
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
                key={message.id}
                mediaStoragePath={message.mediaStoragePath}
                mediaUrl={message.mediaUrl}
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
          editable={!props.composerBlockedMessage}
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
          onSend={canSend && !props.composerBlockedMessage ? handleSend : undefined}
          pendingImageHint="Foto lista. Escribí un texto (opcional) y enviá."
          pendingImageUri={pendingImage?.uri ?? null}
          placeholder={
            props.composerBlockedMessage
              ? 'Respuesta no disponible'
              : 'Escribi un mensaje...'
          }
          value={draft}
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
    paddingBottom: 24,
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
    fontSize: 10,
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
    fontSize: 9,
    fontWeight: '500',
  },
  channelTagText: {
    color: '#1877f2',
    fontSize: 9,
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
    fontSize: 11,
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
    fontSize: 12,
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
    fontSize: 12,
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  leadBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 9,
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
    fontSize: 12,
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
    fontSize: 11,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  windowBlockedText: {
    color: colors.slate,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  statusTab: {
    color: colors.slate,
    flex: 1,
    fontSize: 10,
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
    fontSize: 10,
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
