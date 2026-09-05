import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { CopiSuggestedQuestion } from '../lib/copiSuggestedQuestions';
import { listCopiHomeQuestions, saveCustomCopiQuestions } from '../lib/copiCustomQuestions';
import { formatConversationTime } from '../lib/inboxPresentation';
import {
  ActionRow,
  Card,
  MessageBubble,
  ReplyComposer,
  RobotAvatar,
  ScreenContent,
  ScreenTitle,
} from '../components/ui';
import { Icon } from '../components/icons';
import { colors as dsColors } from '../design-system';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { useAndroidKeyboardHeight } from '../hooks/useAndroidKeyboard';
import { FeatureGate, useFeatureVisibility } from '../hooks/useFeatureVisibility';
import { useHeaderScreenOptions } from '../hooks/useHeaderScreenOptions';
import type { OwnerCopilotState } from '../hooks/useOwnerCopilot';
import type { OwnerDashboard } from '../types/dashboard';
import { colors, shadows } from '../theme';

export type CopiComposerActions = {
  attachmentMenuOpen: boolean;
  canUseVision: boolean;
  canUseVoice: boolean;
  isAnalyzingImage: boolean;
  isRecordingVoice: boolean;
  isTranscribingVoice: boolean;
  onClearPendingImage: () => void;
  onPressAttachCamera: () => void;
  onPressAttachLibrary: () => void;
  onPressPlus: () => void;
  onPressVoice: () => void;
  pendingImageUri: string | null;
};

function askAndOpenChat(params: {
  imageContext?: string;
  onAskQuestion: (question: string, imageContext?: string) => Promise<void>;
  onOpenChat: () => void;
  question: string;
}): void {
  params.onOpenChat();
  void params.onAskQuestion(params.question, params.imageContext);
}

export function CopiScreen(props: {
  composer: CopiComposerActions;
  metrics: OwnerDashboard['metrics'] | null;
  onAskQuestion: (question: string, imageContext?: string) => Promise<void>;
  onOpenChat: () => void;
  onOpenSupport: () => void;
  onResolveImageAsk: (draft: string) => Promise<{ imageContext?: string; question: string }>;
  questionDraft: string;
  setQuestionDraft: (value: string) => void;
}): ReactElement {
  const visibility = useFeatureVisibility();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const hasCopiPro = !visibility.copiProUpsell;
  const [suggestedQuestions, setSuggestedQuestions] = useState<CopiSuggestedQuestion[]>([]);
  const [customDraft, setCustomDraft] = useState('');
  const openConversations = props.metrics?.openConversations ?? 0;
  const lowStockItems = props.metrics?.lowStockItems ?? 0;
  const pendingFollowUps = props.metrics?.pendingFollowUps ?? 0;

  useEffect(() => {
    let mounted = true;
    void listCopiHomeQuestions({ hasCopiPro, organizationId }).then((questions) => {
      if (mounted) {
        setSuggestedQuestions(questions);
      }
    });
    return () => {
      mounted = false;
    };
  }, [hasCopiPro, organizationId]);

  async function handleAddCustomQuestion(): Promise<void> {
    const text = customDraft.trim();
    if (!text || !organizationId || !hasCopiPro) {
      return;
    }

    const builtIns = new Set(
      suggestedQuestions
        .filter((question) => question.tier === 'copi')
        .map((question) => question.text),
    );
    const existingCustom = suggestedQuestions.filter(
      (question) => question.tier === 'copi_pro' && !builtIns.has(question.text),
    );
    // Keep prior custom + new (built-in pro questions stay in defaults loader).
    const nextCustom = [
      ...existingCustom.filter(
        (question) =>
          question.text !== 'Creá una tarea para llamar a un cliente mañana' &&
          question.text !== 'Asigná la tarea pendiente al equipo',
      ),
      { text, tier: 'copi_pro' as const },
    ];
    await saveCustomCopiQuestions(organizationId, nextCustom);
    setCustomDraft('');
    setSuggestedQuestions(await listCopiHomeQuestions({ hasCopiPro, organizationId }));
  }

  return (
    <ScreenContent>
      <ScreenTitle title="Copi" />

      <FeatureGate feature="copiQuickSummary" visibility={visibility}>
        <Pressable
          onPress={hasCopiPro ? props.onOpenChat : undefined}
          style={styles.copiCard}
        >
          <RobotAvatar />
          <View style={[styles.flex, styles.flexShrink]}>
            <Text style={styles.homeCardTitle}>Copi - Tu asistente IA</Text>
            <Text numberOfLines={2} style={styles.cardDescription}>
              {hasCopiPro
                ? 'Preguntame sobre tus ventas, stock, clientes y mas.'
                : 'Elegí una de las 5 preguntas sugeridas para consultar a Copi.'}
            </Text>
          </View>
          {hasCopiPro ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={props.onOpenChat}
              style={styles.chatButton}
            >
              <Icon color={colors.primary} kind="message" size={18} strokeWidth={1.8} />
            </Pressable>
          ) : null}
        </Pressable>
      </FeatureGate>

      <FeatureGate feature="copiProUpsell" visibility={visibility}>
        <Card style={styles.upsellCard}>
          <Text style={styles.upsellTitle}>Activá Copi Pro</Text>
          <Text style={styles.cardDescription}>
            Con Copi básico solo podés usar las preguntas preconfiguradas. Activá Copi Pro para
            escribirle libremente, usar el micrófono, crear tareas y turnos, reportes a medida y
            análisis de fotos.
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={props.onOpenSupport}
            style={styles.supportLink}
          >
            <Text style={styles.supportLinkText}>Contactanos para habilitar Copi Pro</Text>
          </Pressable>
        </Card>
      </FeatureGate>

      <FeatureGate feature="copiQuestionComposer" visibility={visibility}>
        <Card flush style={styles.composerCard}>
          <ReplyComposer
            attachmentMenuOpen={props.composer.attachmentMenuOpen}
            canUseVision={props.composer.canUseVision}
            canUseVoice={props.composer.canUseVoice}
            embedded
            isAnalyzingImage={props.composer.isAnalyzingImage}
            isRecordingVoice={props.composer.isRecordingVoice}
            isTranscribingVoice={props.composer.isTranscribingVoice}
            onChangeText={props.setQuestionDraft}
            onClearPendingImage={props.composer.onClearPendingImage}
            onPressAttachCamera={props.composer.onPressAttachCamera}
            onPressAttachLibrary={props.composer.onPressAttachLibrary}
            onPressPlus={props.composer.onPressPlus}
            onPressVoice={props.composer.onPressVoice}
            onSend={() => {
              void (async () => {
                try {
                  const resolved = await props.onResolveImageAsk(props.questionDraft);
                  props.setQuestionDraft('');
                  askAndOpenChat({
                    imageContext: resolved.imageContext,
                    onAskQuestion: props.onAskQuestion,
                    onOpenChat: props.onOpenChat,
                    question: resolved.question,
                  });
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : 'No se pudo enviar el mensaje';
                  Alert.alert('Copi', message);
                }
              })();
            }}
            pendingImageUri={props.composer.pendingImageUri}
            voiceMode="stt"
            placeholder="Escribí tu pregunta..."
            value={props.questionDraft}
          />
        </Card>
      </FeatureGate>

      <FeatureGate feature="copiSuggestedQuestions" visibility={visibility}>
        <Card flush>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Preguntas sugeridas</Text>
          </View>
          {suggestedQuestions.map((question, index) => (
            <ActionRow
              icon="message"
              key={`${question.tier}-${question.text}`}
              onPress={() =>
                askAndOpenChat({
                  onAskQuestion: props.onAskQuestion,
                  onOpenChat: props.onOpenChat,
                  question: question.text,
                })
              }
              showDivider={index < suggestedQuestions.length - 1 || hasCopiPro}
              title={question.text}
            />
          ))}
          {hasCopiPro ? (
            <View style={styles.customQuestionRow}>
              <TextInput
                onChangeText={setCustomDraft}
                placeholder="Agregar pregunta (Copi Pro)"
                placeholderTextColor={colors.slate}
                style={styles.customQuestionInput}
                value={customDraft}
              />
              <Pressable
                onPress={() => {
                  void handleAddCustomQuestion();
                }}
                style={styles.customQuestionButton}
              >
                <Text style={styles.customQuestionButtonText}>Agregar</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>
      </FeatureGate>

      <FeatureGate feature="copiQuickSummary" visibility={visibility}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            Hoy tenes <Text style={styles.greenText}>{openConversations} conversaciones</Text> abiertas,{' '}
            <Text style={styles.orangeText}>{lowStockItems} productos</Text> con bajo stock y{' '}
            <Text style={styles.purpleText}>{pendingFollowUps} seguimientos</Text> pendientes.
          </Text>
        </Card>
      </FeatureGate>
    </ScreenContent>
  );
}

export function CopiChatScreen(props: {
  composer: CopiComposerActions;
  copilot: OwnerCopilotState;
  onBack: () => void;
  onOpenPresupuesto?: (quoteId: string) => void;
  onOpenProduct?: (productId: string) => void;
  onOpenSupport?: () => void;
  onSend: () => Promise<void> | void;
}): ReactElement {
  const visibility = useFeatureVisibility();
  const scrollRef = useRef<ScrollView>(null);
  const androidKeyboardHeight = useAndroidKeyboardHeight();
  const hasCopiPro = !visibility.copiProUpsell;
  useHeaderScreenOptions({
    forceCollapsed: true,
    onBack: props.onBack,
    title: 'Copi',
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [props.copilot.isAsking, props.copilot.messages]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
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
        <Text style={styles.leadBadge}>Asistente IA</Text>
      </View>

      {props.copilot.policyMessage ? (
        <View style={styles.policyBanner}>
          <Text style={styles.policyText}>{props.copilot.policyMessage}</Text>
        </View>
      ) : null}

      <View style={styles.detailBody}>
        <FeatureGate feature="chatMessages" visibility={visibility}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chatArea}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
            style={styles.chatScroll}
          >
            {props.copilot.isLoadingHistory ? (
              <ActivityIndicator color={colors.primary} style={styles.historyLoader} />
            ) : null}
            {props.copilot.messages.map((message) => (
              <View key={message.id}>
                <MessageBubble
                  direction={message.role === 'owner' ? 'outbound' : 'inbound'}
                  onPressPresupuesto={
                    message.role === 'assistant' ? props.onOpenPresupuesto : undefined
                  }
                  onPressProduct={
                    message.role === 'assistant' ? props.onOpenProduct : undefined
                  }
                  source={message.role === 'owner' ? 'owner' : 'copi'}
                  text={message.body}
                  time={message.id === 'starter' ? '' : formatConversationTime(message.createdAt)}
                />
                {message.proposedActionId ? (
                  <Pressable
                    onPress={() => void props.copilot.confirmProposedAction(message.proposedActionId!)}
                    style={styles.confirmButton}
                  >
                    <Text style={styles.confirmButtonText}>Confirmar acción</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {props.copilot.isAsking ? (
              <View style={styles.typingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.typingText}>Copi está pensando…</Text>
              </View>
            ) : null}
          </ScrollView>
        </FeatureGate>
      </View>

      {hasCopiPro ? (
        <FeatureGate feature="copiComposer" visibility={visibility}>
          <ReplyComposer
            attachmentMenuOpen={props.composer.attachmentMenuOpen}
            canUseVision={props.composer.canUseVision}
            canUseVoice={props.composer.canUseVoice}
            isAnalyzingImage={props.composer.isAnalyzingImage}
            isRecordingVoice={props.composer.isRecordingVoice}
            isSending={props.copilot.isAsking}
            isTranscribingVoice={props.composer.isTranscribingVoice}
            onChangeText={props.copilot.setInputValue}
            onClearPendingImage={props.composer.onClearPendingImage}
            onPressAttachCamera={props.composer.onPressAttachCamera}
            onPressAttachLibrary={props.composer.onPressAttachLibrary}
            onPressPlus={props.composer.onPressPlus}
            onPressVoice={props.composer.onPressVoice}
            onSend={() => void props.onSend()}
            pendingImageUri={props.composer.pendingImageUri}
            placeholder="Escribí un mensaje..."
            value={props.copilot.inputValue}
            voiceMode="stt"
          />
        </FeatureGate>
      ) : (
        <View style={styles.basicComposerBanner}>
          <Text style={styles.basicComposerText}>
            Con Copi básico no podés escribir mensajes libres. Activá Copi Pro para chatear, usar el
            micrófono y el resto de capacidades.
          </Text>
          {props.onOpenSupport ? (
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={props.onOpenSupport}
              style={styles.supportLink}
            >
              <Text style={styles.supportLinkText}>Contactanos para habilitar Copi Pro</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    paddingHorizontal: 14,
  },
  cardDescription: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 20,
    marginTop: 3,
  },
  basicComposerBanner: {
    backgroundColor: colors.surface,
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  basicComposerText: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 20,
  },
  supportLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  supportLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  chatArea: {
    backgroundColor: '#efeae2',
    flexGrow: 1,
    gap: 8,
    minHeight: 448,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  chatBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: dsColors.primarySoft,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chatScroll: {
    flex: 1,
  },
  chatToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  composerCard: {
    ...shadows.card,
  },
  confirmButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  copiCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    paddingHorizontal: 14,
  },
  detailBody: {
    flex: 1,
    minHeight: 0,
  },
  detailRoot: {
    backgroundColor: '#efeae2',
    flex: 1,
    justifyContent: 'space-between',
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
    fontWeight: '600',
  },
  historyLoader: {
    marginVertical: 12,
  },
  homeCardTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 16,
  },
  leadBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  listHeader: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  customQuestionButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customQuestionButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  customQuestionInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  customQuestionRow: {
    alignItems: 'center',
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  orangeText: {
    color: colors.warning,
    fontWeight: '600',
  },
  policyBanner: {
    backgroundColor: '#fff7ed',
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  policyText: {
    color: colors.navy,
    fontSize: 15,
    lineHeight: 16,
  },
  purpleText: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryCard: {
    padding: 14,
  },
  summaryText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 16,
  },
  typingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  typingText: {
    color: colors.slate,
    fontSize: 15,
  },
  upsellCard: {
    backgroundColor: '#f8faf8',
    padding: 14,
  },
  upsellTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
});
