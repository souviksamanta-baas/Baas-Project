import type { ReactElement } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton } from '../design-system';
import { normalizePhoneNumber } from '../services/phone';
import { colors } from '../theme';

/** Nexolia support line (Córdoba / Villa María area). Kept private in UI. */
const SUPPORT_WHATSAPP_DISPLAY = '03546-517096';

export function buildSupportWhatsAppUrl(displayNumber = SUPPORT_WHATSAPP_DISPLAY): string {
  const e164 = normalizePhoneNumber(displayNumber) ?? '+543546517096';
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}

export function HelpSupportScreen(props: { onBack: () => void }): ReactElement {
  async function openWhatsApp(): Promise<void> {
    await Linking.openURL(buildSupportWhatsAppUrl());
  }

  return (
    <ScreenContent title="Ayuda y soporte">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle subtitle="Estamos para acompañarte" title="Ayuda y soporte" />
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.lead}>
          En Nexolia la ayuda es personalizada: te acompañamos según cómo opera tu negocio, no con
          respuestas genéricas.
        </Text>
        <Text style={styles.body}>
          Dejanos un mensaje por WhatsApp y te respondemos a la brevedad. Podés contarnos dudas de
          stock, ventas, equipo o configuración.
        </Text>
        <PrimaryButton
          fullWidth
          label="Abrir chat en WhatsApp"
          onPress={() => void openWhatsApp()}
        />
      </Card>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backPressable: {
    paddingRight: 4,
    paddingVertical: 2,
  },
  backText: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  lead: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
