import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  copiProSuggestedQuestions,
  copiSuggestedQuestions,
} from '../lib/copiSuggestedQuestions';
import {
  ActionRow,
  Card,
  MessageBubble,
  ReplyComposer,
  RobotAvatar,
  ScreenContent,
  ScreenTitle,
} from '../components/ui';
import { FeatureGate, useFeatureGate, useFeatureVisibility } from '../hooks/useFeatureVisibility';
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
  onPressAttachCamera: () => void;
  onPressAttachLibrary: () => void;
  onPressPlus: () => void;
  onPressVoice: () => void;
};

function askAndOpenChat(params: {
  onAskQuestion: (question: string) => Promise<void>;
  onOpenChat: () => void;
  question: string;
}): void {
  params.onOpenChat();
  void params.onAskQuestion(params.question);
}

export function CopiScreen(props: {
  composer: CopiComposerActions;
  metrics: OwnerDashboard['metrics'] | null;
  onAskQuestion: (question: string) => Promise<void>;
  onOpenChat: () => void;
  questionDraft: string;
  setQuestionDraft: (value: string) => void;
}): ReactElement {
  const visibility = useFeatureVisibility();
  const openConversations = props.metrics?.openConversations ?? 0;
  const lowStockItems = props.metrics?.lowStockItems ?? 0;
  const pendingFollowUps = props.metrics?.pendingFollowUps ?? 0;

  return (
    <ScreenContent>
      <ScreenTitle subtitle="Tu asistente IA para el negocio" title="Copi" />

      <FeatureGate feature="copiQuickSummary" visibility={visibility}>
        <View style={styles.welcomeCard}>
          <RobotAvatar />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Hola! Soy Copi</Text>
            <Text style={styles.cardDescription}>Preguntame por ventas, stock, clientes y tareas pendientes.</Text>
          </View>
        </View>
      </FeatureGate>

      <FeatureGate feature="copiProUpsell" visibility={visibility}>
        <Card style={styles.upsellCard}>
          <Text style={styles.upsellTitle}>Copi Pro</Text>
          <Text style={styles.cardDescription}>
            Activá acciones, voz, visión e informes personalizados para que Copi haga tareas por vos.
          </Text>
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
            onPressAttachCamera={props.composer.onPressAttachCamera}
            onPressAttachLibrary={props.composer.onPressAttachLibrary}
            onPressPlus={props.composer.onPressPlus}
            onPressVoice={props.composer.onPressVoice}
            onSend={() => {
              const question = props.questionDraft.trim();
              if (!question) {
                return;
              }

              props.setQuestionDraft('');
              askAndOpenChat({
                onAskQuestion: props.onAskQuestion,
                onOpenChat: props.onOpenChat,
                question,
              });
            }}
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
          {copiSuggestedQuestions.map((question) => (
            <ActionRow
              icon="message"
              key={question}
              onPress={() =>
                askAndOpenChat({
                  onAskQuestion: props.onAskQuestion,
                  onOpenChat: props.onOpenChat,
                  question,
                })
              }
              title={question}
            />
          ))}
        </Card>
      </FeatureGate>

      {!visibility.copiProUpsell ? (
        <Card flush>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Copi Pro</Text>
          </View>
          {copiProSuggestedQuestions.map((question) => (
            <ActionRow
              icon="message"
              key={question}
              onPress={() =>
                askAndOpenChat({
                  onAskQuestion: props.onAskQuestion,
                  onOpenChat: props.onOpenChat,
                  question,
                })
              }
              title={question}
            />
          ))}
        </Card>
      ) : null}

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
}): ReactElement {
  const visibility = useFeatureVisibility();

  return (
    <View style={styles.chatRoot}>
      <View style={styles.chatBody}>
        <Card flush>
          <FeatureGate feature="chatProfileHeader" visibility={visibility}>
            <View style={styles.threadHeader}>
              <Text onPress={props.onBack} style={styles.backText}>‹</Text>
              <RobotAvatar small />
              <View>
                <Text style={styles.profileTitle}>Copi</Text>
                <Text style={styles.cardDescription}>Asistente IA</Text>
              </View>
            </View>
          </FeatureGate>

          {props.copilot.policyMessage ? (
            <View style={styles.policyBanner}>
              <Text style={styles.policyText}>{props.copilot.policyMessage}</Text>
            </View>
          ) : null}

          <FeatureGate feature="chatMessages" visibility={visibility}>
            <View style={styles.chatArea}>
              {props.copilot.messages.map((message) => (
                <View key={message.id}>
                  <MessageBubble
                    direction={message.role === 'owner' ? 'outbound' : 'inbound'}
                    source={message.role === 'owner' ? 'owner' : 'copi'}
                    text={message.body}
                    time={new Date(message.createdAt).toLocaleTimeString('es-AR', {
                      hour: 'numeric',
                      hour12: true,
                      minute: '2-digit',
                    })}
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
            </View>
          </FeatureGate>
        </Card>
      </View>

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
          onPressAttachCamera={props.composer.onPressAttachCamera}
          onPressAttachLibrary={props.composer.onPressAttachLibrary}
          onPressPlus={props.composer.onPressPlus}
          onPressVoice={props.composer.onPressVoice}
          onSend={() => void props.copilot.askQuestion()}
          placeholder="Escribí tu pregunta..."
          value={props.copilot.inputValue}
        />
      </FeatureGate>
    </View>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
  },
  cardDescription: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '300',
    lineHeight: 16,
    marginTop: 3,
  },
  cardTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  chatArea: {
    backgroundColor: '#fcfdfc',
    gap: 12,
    minHeight: 448,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  chatBody: {
    flex: 1,
    paddingHorizontal: 8,
  },
  chatRoot: {
    flex: 1,
    justifyContent: 'space-between',
  },
  composerCard: {
    ...shadows.card,
  },
  confirmButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmButtonText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  flex: {
    flex: 1,
  },
  greenText: {
    color: colors.primary,
    fontWeight: '600',
  },
  listHeader: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  orangeText: {
    color: colors.warning,
    fontWeight: '600',
  },
  policyBanner: {
    backgroundColor: '#fff7ed',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  policyText: {
    color: colors.navy,
    fontSize: 11,
    lineHeight: 16,
  },
  profileTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 19,
  },
  purpleText: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryCard: {
    padding: 14,
  },
  summaryText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '300',
    lineHeight: 16,
  },
  threadHeader: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    height: 74,
    paddingHorizontal: 16,
  },
  typingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  typingText: {
    color: colors.slate,
    fontSize: 11,
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
  welcomeCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    height: 86,
    paddingHorizontal: 14,
  },
});
