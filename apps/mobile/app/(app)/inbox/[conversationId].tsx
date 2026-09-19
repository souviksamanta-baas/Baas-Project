import {
  Contact,
  ContactField,
  requestPermissionsAsync,
} from 'expo-contacts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Clipboard, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import {
  assignConversationToCopi,
  hideConversationMessage,
  markConversationRead,
  updateContactLeadStatus,
  type ManualLeadStatus,
} from '../../../src/api/conversationActions';
import { getInboxConversations } from '../../../src/api/conversations';
import {
  editConversationMessage,
  forwardConversationMessage,
  reactToConversationMessage,
} from '../../../src/api/whatsapp';
import {
  MessageActionOverlay,
  type MessageActionId,
} from '../../../src/components/MessageActionOverlay';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import {
  useConversationThread,
  useInboxConversation,
} from '../../../src/hooks/useConversationThread';
import {
  conversationAvatarLabel,
  conversationDisplayName,
} from '../../../src/lib/inboxPresentation';
import { useDeviceContactNames } from '../../../src/lib/deviceContactNames';
import { supabase } from '../../../src/lib/supabase';
import { routes } from '../../../src/navigation/routes';
import { ConversationDetailScreen } from '../../../src/screens/InboxScreen';
import type { WhatsAppMessagePreview } from '../../../src/types/messages';

const LABEL_OPTIONS: Array<{ label: string; value: ManualLeadStatus }> = [
  { label: 'Nuevo', value: 'new' },
  { label: 'Oportunidad', value: 'opportunity' },
  { label: 'Seguimiento pendiente', value: 'active' },
  { label: 'Ganado', value: 'won' },
  { label: 'Perdido', value: 'lost' },
  { label: 'Terminado', value: 'finished' },
];

async function isPhoneInDeviceContacts(phone: string): Promise<boolean> {
  const permission = await requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return false;
  }

  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return false;
  }

  const contacts = await Contact.getAllDetails([ContactField.PHONES]);
  return contacts.some((contact) =>
    (contact.phones ?? []).some((entry) => {
      const candidate = (entry.number ?? '').replace(/\D/g, '');
      return candidate.includes(digits) || digits.includes(candidate);
    }),
  );
}

export default function ConversationDetailRoute(): ReactElement {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const { conversation, isLoading: isLoadingConversation } = useInboxConversation({
    businessCenterId,
    conversationId: conversationId ?? null,
    organizationId,
  });
  const thread = useConversationThread({
    channel: conversation?.channel ?? null,
    businessCenterId,
    conversationId: conversationId ?? null,
    messagesClearedAt: conversation?.messagesClearedAt ?? null,
    organizationId,
  });
  const deviceContacts = useDeviceContactNames();
  const resolvedCustomerName = conversation
    ? conversationDisplayName(
        conversation,
        deviceContacts.resolveName(
          conversation.contact.phoneNumber ?? conversation.externalContactId,
        ),
      )
    : 'Conversación';
  const [showAddContact, setShowAddContact] = useState(false);
  const [replySeed, setReplySeed] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [menuMessage, setMenuMessage] = useState<WhatsAppMessagePreview | null>(null);
  const [androidEditMessage, setAndroidEditMessage] = useState<WhatsAppMessagePreview | null>(
    null,
  );
  const [androidEditDraft, setAndroidEditDraft] = useState('');

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    void markConversationRead(conversationId).catch(() => undefined);
  }, [conversationId]);

  useEffect(() => {
    const phone = conversation?.contact.phoneNumber ?? conversation?.externalContactId ?? null;
    if (!phone || conversation?.channel !== 'whatsapp') {
      setShowAddContact(false);
      return;
    }
    let mounted = true;
    void isPhoneInDeviceContacts(phone)
      .then((found) => {
        if (mounted) {
          setShowAddContact(!found);
        }
      })
      .catch(() => {
        if (mounted) {
          setShowAddContact(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [conversation]);

  const handleAddDeviceContact = useCallback(async (): Promise<void> => {
    const phone = conversation?.contact.phoneNumber ?? conversation?.externalContactId;
    if (!phone) {
      return;
    }
    try {
      const permission = await requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a contactos para guardar el número.');
        return;
      }

      const givenName = conversation?.contact.displayName?.trim() || undefined;
      const created = await Contact.presentCreateForm({
        ...(givenName && !/^\+?\d[\d\s-]*$/.test(givenName) ? { givenName } : {}),
        phones: [{ label: 'mobile', number: phone }],
      });
      if (created) {
        setShowAddContact(false);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo abrir contactos',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }, [conversation]);

  const requireWhatsAppContext = useCallback((): {
    businessCenterId: string;
    organizationId: string;
  } | null => {
    if (!organizationId || !businessCenterId) {
      Alert.alert('Error', 'Falta el contexto de la organización.');
      return null;
    }
    if (conversation?.channel && conversation.channel !== 'whatsapp') {
      Alert.alert('No disponible', 'Esta acción solo está disponible en WhatsApp por ahora.');
      return null;
    }
    return { businessCenterId, organizationId };
  }, [businessCenterId, conversation?.channel, organizationId]);

  const handleReact = useCallback(
    async (message: WhatsAppMessagePreview, emoji: string): Promise<void> => {
      const ctx = requireWhatsAppContext();
      if (!ctx) {
        return;
      }
      try {
        await reactToConversationMessage({
          businessCenterId: ctx.businessCenterId,
          emoji,
          messageId: message.id,
          organizationId: ctx.organizationId,
        });
        await thread.reloadMessages();
      } catch (error) {
        Alert.alert(
          'No se pudo reaccionar',
          error instanceof Error ? error.message : 'Error',
        );
      }
    },
    [requireWhatsAppContext, thread],
  );

  const handleEdit = useCallback(
    (message: WhatsAppMessagePreview): void => {
      if (message.direction !== 'outbound' || message.messageType !== 'text') {
        Alert.alert('Editar', 'Solo se pueden editar tus mensajes de texto enviados.');
        return;
      }
      const applyEdit = (nextBody: string): void => {
        const trimmed = nextBody.trim();
        if (!trimmed) {
          return;
        }
        const ctx = requireWhatsAppContext();
        if (!ctx) {
          return;
        }
        void editConversationMessage({
          body: trimmed,
          businessCenterId: ctx.businessCenterId,
          messageId: message.id,
          organizationId: ctx.organizationId,
        })
          .then(() => thread.reloadMessages())
          .catch((error) =>
            Alert.alert('No se pudo editar', error instanceof Error ? error.message : 'Error'),
          );
      };

      if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
        Alert.prompt(
          'Editar mensaje',
          undefined,
          (value) => {
            if (typeof value === 'string') {
              applyEdit(value);
            }
          },
          'plain-text',
          message.body ?? '',
        );
        return;
      }

      setAndroidEditMessage(message);
      setAndroidEditDraft(message.body ?? '');
    },
    [requireWhatsAppContext, thread],
  );

  const handleForward = useCallback(
    async (message: WhatsAppMessagePreview): Promise<void> => {
      const ctx = requireWhatsAppContext();
      if (!ctx || !conversationId) {
        return;
      }
      try {
        const conversations = await getInboxConversations(
          ctx.organizationId,
          ctx.businessCenterId,
        );
        const targets = conversations
          .filter((item) => item.id !== conversationId && item.channel === 'whatsapp')
          .slice(0, 6);
        if (targets.length === 0) {
          Alert.alert('Reenviar', 'No hay otras conversaciones de WhatsApp disponibles.');
          return;
        }
        Alert.alert('Reenviar a', undefined, [
          ...targets.map((target) => ({
            text: conversationDisplayName(target),
            onPress: () => {
              void forwardConversationMessage({
                businessCenterId: ctx.businessCenterId,
                messageId: message.id,
                organizationId: ctx.organizationId,
                targetConversationId: target.id,
              }).catch((error) =>
                Alert.alert(
                  'No se pudo reenviar',
                  error instanceof Error ? error.message : 'Error',
                ),
              );
            },
          })),
          { text: 'Cancelar', style: 'cancel' as const },
        ]);
      } catch (error) {
        Alert.alert(
          'No se pudo reenviar',
          error instanceof Error ? error.message : 'Error',
        );
      }
    },
    [conversationId, requireWhatsAppContext],
  );

  const handleAssignLabel = useCallback(
    (contactId: string): void => {
      Alert.alert(
        'Asignar etiqueta',
        undefined,
        LABEL_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => {
            void updateContactLeadStatus({
              contactId,
              leadStatus: option.value,
            }).catch((error) =>
              Alert.alert(
                'No se pudo actualizar',
                error instanceof Error ? error.message : 'Error',
              ),
            );
          },
        })),
      );
    },
    [],
  );

  const handleAskCopi = useCallback(
    async (message: WhatsAppMessagePreview): Promise<void> => {
      if (!conversationId || !conversation) {
        return;
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) {
          Alert.alert('Sesión', 'Tenés que iniciar sesión para asignar a Copi.');
          return;
        }
        await assignConversationToCopi({ conversationId, userId });

        const clientBody = (message.body ?? '').trim() || '(sin texto / media)';
        // Owner-visible Copi bubble: short and readable. Conversation is already
        // assigned to Copi, so tools resolve the chat without embedding the UUID.
        const seedQuestion = [
          `Respondé al cliente ${resolvedCustomerName} por WhatsApp.`,
          '',
          'Mensaje del cliente:',
          `«${clientBody}»`,
          '',
          'Proponé el texto exacto a enviar en español. No envíes nada hasta que confirme.',
        ].join('\n');

        router.push({
          pathname: routes.appCopiChat,
          params: { seedQuestion },
        } as never);
      } catch (error) {
        Alert.alert(
          'No se pudo asignar',
          error instanceof Error ? error.message : 'Error desconocido',
        );
      }
    },
    [conversation, conversationId, resolvedCustomerName, router],
  );

  const handleMenuAction = useCallback(
    (action: MessageActionId): void => {
      const message = menuMessage;
      setMenuMessage(null);
      if (!message) {
        return;
      }

      if (action === 'reply') {
        const quote = (message.body ?? 'Nota de voz / media').trim().slice(0, 200);
        setReplyToMessageId(message.id);
        setReplySeed(`${Date.now()}|${quote}`);
        return;
      }
      if (action === 'forward') {
        void handleForward(message);
        return;
      }
      if (action === 'copy') {
        if (message.body) {
          Clipboard.setString(message.body);
        }
        return;
      }
      if (action === 'edit') {
        handleEdit(message);
        return;
      }
      if (action === 'ask-copi') {
        void handleAskCopi(message);
        return;
      }
      if (action === 'assign-label') {
        const contactId = conversation?.contact.id;
        if (contactId) {
          handleAssignLabel(contactId);
        }
        return;
      }
      if (action === 'delete') {
        void hideConversationMessage(message.id)
          .then(() => thread.reloadMessages())
          .catch((error) =>
            Alert.alert(
              'No se pudo eliminar',
              error instanceof Error ? error.message : 'Error',
            ),
          );
      }
    },
    [
      conversation?.contact.id,
      handleAskCopi,
      handleAssignLabel,
      handleEdit,
      handleForward,
      menuMessage,
      thread,
    ],
  );

  const canSendReply = Boolean(
    organizationId && businessCenterId && conversationId && !thread.composerBlockedMessage,
  );

  const selectedEmoji =
    menuMessage?.reactions?.find((reaction) => reaction.actor === 'owner')?.emoji ?? null;

  const detail = (
    <ConversationDetailScreen
      channel={conversation?.channel}
      composerBlockedMessage={thread.composerBlockedMessage}
      customerName={resolvedCustomerName}
      displayPhoneNumber={dashboard?.whatsappConnection?.displayPhoneNumber ?? null}
      isLoading={isLoadingConversation || thread.isLoading}
      messages={thread.messages}
      onAddDeviceContact={
        conversation
          ? () => {
              void handleAddDeviceContact();
            }
          : undefined
      }
      onBack={() => router.replace(routes.appInbox)}
      onMessageLongPress={setMenuMessage}
      onSendAudio={canSendReply ? thread.sendAudioReply : undefined}
      onSendImage={canSendReply ? thread.sendImageReply : undefined}
      onSendReply={
        canSendReply
          ? async (body) => {
              await thread.sendReply(body, { replyToMessageId });
              setReplyToMessageId(null);
              setReplySeed(null);
            }
          : undefined
      }
      phoneNumber={conversation?.contact.phoneNumber}
      replySeed={replySeed}
      showAddContact={showAddContact}
      threadAvatar={
        conversation
          ? conversationAvatarLabel(
              conversation,
              deviceContacts.resolveName(
                conversation.contact.phoneNumber ?? conversation.externalContactId,
              ),
            )
          : undefined
      }
    />
  );

  return (
    <View style={{ flex: 1 }}>
      {detail}
      {androidEditMessage ? (
        <Modal
          animationType="fade"
          onRequestClose={() => setAndroidEditMessage(null)}
          transparent
          visible
        >
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              flex: 1,
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
              <Text style={{ fontWeight: '600', marginBottom: 8 }}>Editar mensaje</Text>
              <TextInput
                autoFocus
                multiline
                onChangeText={setAndroidEditDraft}
                style={{ minHeight: 80, marginBottom: 12 }}
                value={androidEditDraft}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
                <Pressable onPress={() => setAndroidEditMessage(null)}>
                  <Text>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const message = androidEditMessage;
                    const draft = androidEditDraft;
                    setAndroidEditMessage(null);
                    if (!message) {
                      return;
                    }
                    const trimmed = draft.trim();
                    if (!trimmed) {
                      return;
                    }
                    const ctx = requireWhatsAppContext();
                    if (!ctx) {
                      return;
                    }
                    void editConversationMessage({
                      body: trimmed,
                      businessCenterId: ctx.businessCenterId,
                      messageId: message.id,
                      organizationId: ctx.organizationId,
                    })
                      .then(() => thread.reloadMessages())
                      .catch((error) =>
                        Alert.alert(
                          'No se pudo editar',
                          error instanceof Error ? error.message : 'Error',
                        ),
                      );
                  }}
                >
                  <Text style={{ fontWeight: '600' }}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
      <MessageActionOverlay
        canEdit={
          menuMessage?.direction === 'outbound' && menuMessage.messageType === 'text'
        }
        onAction={handleMenuAction}
        onClose={() => setMenuMessage(null)}
        onReact={(emoji) => {
          const message = menuMessage;
          setMenuMessage(null);
          if (message) {
            void handleReact(message, emoji);
          }
        }}
        selectedEmoji={selectedEmoji}
        visible={Boolean(menuMessage)}
      />
    </View>
  );
}
