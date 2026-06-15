import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { copiMessages, suggestedQuestions } from '../api/mockData';
import {
  ActionRow,
  Card,
  MessageBubble,
  ReplyComposer,
  RobotAvatar,
  ScreenContent,
  ScreenTitle,
} from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { colors, shadows } from '../theme';

export function CopiScreen(props: { onOpenChat: () => void }): ReactElement {
  return (
    <ScreenContent>
      <ScreenTitle subtitle="Tu asistente IA para el negocio" title="Copi" />

      <FeatureGate feature="copiQuickSummary">
        <View style={styles.welcomeCard}>
          <RobotAvatar />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Hola! Soy Copi</Text>
            <Text style={styles.cardDescription}>Preguntame por ventas, stock, clientes y tareas pendientes.</Text>
          </View>
        </View>
      </FeatureGate>

      <FeatureGate feature="copiQuestionComposer">
        <View onTouchEnd={props.onOpenChat} style={styles.landingComposer}>
          <ReplyComposer placeholder="Escribí tu pregunta..." />
        </View>
      </FeatureGate>

      <FeatureGate feature="copiSuggestedQuestions">
        <Text style={styles.sectionTitle}>Preguntas sugeridas</Text>
        <Card>
          {suggestedQuestions.map((question) => (
            <ActionRow icon="message" key={question} onPress={props.onOpenChat} title={question} />
          ))}
        </Card>
      </FeatureGate>

      <FeatureGate feature="copiQuickSummary">
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            Hoy tenes <Text style={styles.greenText}>12 conversaciones</Text> abiertas,{' '}
            <Text style={styles.orangeText}>3 productos</Text> con bajo stock y{' '}
            <Text style={styles.purpleText}>4 seguimientos</Text> pendientes.
          </Text>
        </Card>
      </FeatureGate>
    </ScreenContent>
  );
}

export function CopiChatScreen(props: { onBack: () => void }): ReactElement {
  return (
    <View style={styles.chatRoot}>
      <View style={styles.chatBody}>
        <Card>
          <FeatureGate feature="chatProfileHeader">
            <View style={styles.threadHeader}>
              <Text onPress={props.onBack} style={styles.backText}>‹</Text>
              <RobotAvatar small />
              <View>
                <Text style={styles.profileTitle}>Copi</Text>
                <Text style={styles.cardDescription}>Asistente IA</Text>
              </View>
            </View>
          </FeatureGate>
          <FeatureGate feature="chatMessages">
            <View style={styles.chatArea}>
              {copiMessages.map((message) => (
                <MessageBubble
                  direction={message.direction}
                  key={message.id}
                  source={message.source ?? (message.direction === 'inbound' ? 'copi' : 'owner')}
                  text={message.text}
                  time={message.time}
                />
              ))}
            </View>
          </FeatureGate>
        </Card>
      </View>
      <FeatureGate feature="copiComposer">
        <ReplyComposer placeholder="Escribí tu pregunta..." />
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
  flex: {
    flex: 1,
  },
  greenText: {
    color: colors.primary,
    fontWeight: '600',
  },
  orangeText: {
    color: colors.warning,
    fontWeight: '600',
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
  landingComposer: {
    marginHorizontal: -20,
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
