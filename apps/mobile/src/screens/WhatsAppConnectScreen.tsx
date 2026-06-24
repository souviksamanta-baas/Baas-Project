import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  InfoBanner,
  PrimaryButton,
  ScreenContent,
  ScreenHeader,
  TextField,
  colors,
  spacing,
  textStyles,
} from '../design-system';
import type { OwnerDashboard } from '../types/dashboard';
import { whatsappConnectionLabel } from '../services/whatsapp';

export function WhatsAppConnectScreen(props: {
  connection: OwnerDashboard['whatsappConnection'];
  displayPhoneNumber: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onChangeDisplayPhoneNumber: (value: string) => void;
  onChangePhoneNumberId: (value: string) => void;
  onChangeWabaId: (value: string) => void;
  onSubmit: () => void;
  phoneNumberId: string;
  wabaId: string;
}): ReactElement {
  const connectionCopy = whatsappConnectionLabel(props.connection);

  return (
    <ScreenContent>
      <ScreenHeader
        subtitle="Conectá tu número de WhatsApp Business con Meta Cloud API"
        title="WhatsApp Business"
      />

      <InfoBanner>{`${connectionCopy.title}\n${connectionCopy.subtitle}`}</InfoBanner>

      <View style={styles.form}>
        <Text style={styles.helpText}>
          Necesitás el Phone Number ID y el WABA ID desde Meta Business Suite. El token de acceso
          queda solo en el servidor.
        </Text>

        <TextField
          autoCapitalize="none"
          label="Phone Number ID"
          onChangeText={props.onChangePhoneNumberId}
          placeholder="123456789012345"
          value={props.phoneNumberId}
        />
        <TextField
          autoCapitalize="none"
          label="WABA ID (opcional)"
          onChangeText={props.onChangeWabaId}
          placeholder="987654321098765"
          value={props.wabaId}
        />
        <TextField
          autoCapitalize="none"
          keyboardType="phone-pad"
          label="Número visible"
          onChangeText={props.onChangeDisplayPhoneNumber}
          placeholder="+5411… o 011…"
          value={props.displayPhoneNumber}
        />

        {props.errorMessage ? <Text style={styles.errorText}>{props.errorMessage}</Text> : null}

        <PrimaryButton
          disabled={props.isSubmitting}
          fullWidth
          label={props.isSubmitting ? 'Verificando…' : 'Conectar WhatsApp'}
          onPress={props.onSubmit}
        />
      </View>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  helpText: {
    ...textStyles.bodySm,
    color: colors.textSecondary,
  },
});
