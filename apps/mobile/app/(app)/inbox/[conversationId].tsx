import * as Contacts from 'expo-contacts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Clipboard, Platform } from 'react-native';

import {
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
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import {
  useConversationThread,
  useInboxConversation,
} from '../../../src/hooks/useConversationThread';
import {
  conversationAvatarLabel,
  conversationDisplayName,
  leadStatusLabel,
} from '../../../src/lib/inboxPresentation';
import { routes } from '../../../src/navigation/routes';
import { ConversationDetailScreen } from '../../../src/screens/InboxScreen';
import type { WhatsAppMessagePreview } from '../../../src/types/messages';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

async function isPhoneInDeviceContacts(phone: string): Promise<boolean> {
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) {
    return false;
  }

  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return false;
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  return data.some((contact) =>
    (contact.phoneNumbers ?? []).some((entry) => {
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
  const [showAddContact, setShowAddContact] = useState(false);
  const [replySeed, setReplySeed] = useState<string | null>(null);

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
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a contactos para guardar el número.');
        return;
      }

      await Contacts.addContactAsync({
        contactType: Contacts.ContactTypes.Person,
        name: conversation?.contact.displayName?.trim() || phone,
        [Contacts.Fields.FirstName]:
          conversation?.contact.displayName?.trim() || phone,
        [Contacts.Fields.PhoneNumbers]: [
          {
            label: 'mobile',
            number: phone,
          },
        ],
      });
      setShowAddContact(false);
      Alert.alert('Listo', 'Contacto guardado en la agenda del teléfono.');
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
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
    (message: WhatsAppMessagePreview): void => {
      Alert.alert(
        'Reaccionar',
        undefined,
        [
          ...REACTION_EMOJIS.map((emoji) => ({
            text: emoji,
            onPress: () => {
              const ctx = requireWhatsAppContext();
              if (!ctx) {
                return;
              }
              void reactToConversationMessage({
                businessCenterId: ctx.businessCenterId,
                emoji,
                messageId: message.id,
                organizationId: ctx.organizationId,
              }).catch((error) =>
                Alert.alert(
                  'No se pudo reaccionar',
                  error instanceof Error ? error.message : 'Error',
                ),
              );
            },
          })),
          { text: 'Cancelar', style: 'cancel' as const },
        ],
      );
    },
    [requireWhatsAppContext],
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
        }).catch((error) =>
          Alert.alert('No se pudo editar', error instanceof Error ? error.message : 'Error'),
        );
      };

      if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
        Alert.prompt('Editar mensaje', undefined, (value) => {
          if (typeof value === 'string') {
            applyEdit(value);
          }
        }, 'plain-text', message.body ?? '');
        return;
      }

      Alert.alert(
        'Editar mensaje',
        'En Android, reescribí el mensaje completo a continuación y confirmá.',
        [
          {
            text: 'Usar texto actual',
            onPress: () => applyEdit(message.body ?? ''),
          },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
    },
    [requireWhatsAppContext],
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
        Alert.alert(
          'Reenviar a',
          undefined,
          [
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
          ],
        );
      } catch (error) {
        Alert.alert(
          'No se pudo reenviar',
          error instanceof Error ? error.message : 'Error',
        );
      }
    },
    [conversationId, requireWhatsAppContext],
  );

  const handleMessageLongPress = useCallback(
    (message: WhatsAppMessagePreview): void => {
      const contactId = conversation?.contact.id;
      Alert.alert('Mensaje', undefined, [
        {
          text: 'Reaccionar',
          onPress: () => handleReact(message),
        },
        {
          text: 'Responder',
          onPress: () => {
            const quote = (message.body ?? 'Nota de voz / media').trim().slice(0, 200);
            setReplySeed(`${Date.now()}|${quote}`);
          },
        },
        {
          text: 'Editar',
          onPress: () => handleEdit(message),
        },
        {
          text: 'Reenviar',
          onPress: () => {
            void handleForward(message);
          },
        },
        {
          text: 'Copiar',
          onPress: () => {
            if (message.body) {
              Clipboard.setString(message.body);
            }
          },
        },
        {
          text: 'Preguntar a Copi',
          onPress: () => {
            const seed = [
              `Cliente: ${conversationDisplayName(conversation!)}`,
              `Canal: ${conversation?.channel ?? 'whatsapp'}`,
              `Mensaje: ${message.body ?? '(sin texto)'}`,
            ].join('\n');
            router.push({
              pathname: routes.appCopiChat,
              params: { seed },
            });
          },
        },
        contactId
          ? {
              text: 'Cambiar estado a',
              onPress: () => {
                Alert.alert('Cambiar estado a', undefined, [
                  {
                    text: 'Ganado',
                    onPress: () => {
                      void updateContactLeadStatus({
                        contactId,
                        leadStatus: 'won' satisfies ManualLeadStatus,
                      }).catch((error) =>
                        Alert.alert(
                          'No se pudo actualizar',
                          error instanceof Error ? error.message : 'Error',
                        ),
                      );
                    },
                  },
                  {
                    text: 'Perdido',
                    onPress: () => {
                      void updateContactLeadStatus({
                        contactId,
                        leadStatus: 'lost',
                      }).catch((error) =>
                        Alert.alert(
                          'No se pudo actualizar',
                          error instanceof Error ? error.message : 'Error',
                        ),
                      );
                    },
                  },
                  {
                    text: 'Terminado',
                    onPress: () => {
                      void updateContactLeadStatus({
                        contactId,
                        leadStatus: 'finished',
                      }).catch((error) =>
                        Alert.alert(
                          'No se pudo actualizar',
                          error instanceof Error ? error.message : 'Error',
                        ),
                      );
                    },
                  },
                  { text: 'Cancelar', style: 'cancel' },
                ]);
              },
            }
          : undefined,
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void hideConversationMessage(message.id).catch((error) =>
              Alert.alert(
                'No se pudo eliminar',
                error instanceof Error ? error.message : 'Error',
              ),
            );
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ].filter(Boolean) as Array<{
        text: string;
        style?: 'cancel' | 'destructive';
        onPress?: () => void;
      }>);
    },
    [conversation, handleEdit, handleForward, handleReact, router],
  );

  const canSendReply = Boolean(
    organizationId && businessCenterId && conversationId && !thread.composerBlockedMessage,
  );

  if (!conversation) {
    return (
      <ConversationDetailScreen
        composerBlockedMessage={thread.composerBlockedMessage}
        customerName="Conversación"
        isLoading={isLoadingConversation || thread.isLoading}
        messages={thread.messages}
        onBack={() => router.replace(routes.appInbox)}
        onMessageLongPress={handleMessageLongPress}
        onSendAudio={canSendReply ? thread.sendAudioReply : undefined}
        onSendImage={canSendReply ? thread.sendImageReply : undefined}
        onSendReply={canSendReply ? thread.sendReply : undefined}
        replySeed={replySeed}
        statusLabel={undefined}
      />
    );
  }

  return (
    <ConversationDetailScreen
      channel={conversation.channel}
      composerBlockedMessage={thread.composerBlockedMessage}
      customerName={conversationDisplayName(conversation)}
      displayPhoneNumber={dashboard?.whatsappConnection?.displayPhoneNumber ?? null}
      isLoading={thread.isLoading}
      messages={thread.messages}
      onAddDeviceContact={() => {
        void handleAddDeviceContact();
      }}
      onBack={() => router.replace(routes.appInbox)}
      onMessageLongPress={handleMessageLongPress}
      onSendAudio={canSendReply ? thread.sendAudioReply : undefined}
      onSendImage={canSendReply ? thread.sendImageReply : undefined}
      onSendReply={canSendReply ? thread.sendReply : undefined}
      phoneNumber={conversation.contact.phoneNumber}
      replySeed={replySeed}
      showAddContact={showAddContact}
      statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
      threadAvatar={conversationAvatarLabel(conversation)}
    />
  );
}
