import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconKind } from '../components/icons';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { colors } from '../theme';
import type { OwnerDashboard } from '../types/dashboard';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';

type IntegrationId = 'whatsapp' | 'instagram' | 'email' | 'sms';

const INTEGRATIONS: Array<{
  comingSoon?: boolean;
  icon: IconKind;
  id: IntegrationId;
  subtitle: string;
  title: string;
}> = [
  {
    icon: 'whatsapp',
    id: 'whatsapp',
    subtitle: 'Inbox y mensajes con clientes',
    title: 'WhatsApp Business',
  },
  {
    comingSoon: true,
    icon: 'instagram',
    id: 'instagram',
    subtitle: 'Mensajes y comentarios de Instagram',
    title: 'Instagram',
  },
  {
    comingSoon: true,
    icon: 'email',
    id: 'email',
    subtitle: 'Correo transaccional y campañas',
    title: 'Email',
  },
  {
    comingSoon: true,
    icon: 'message',
    id: 'sms',
    subtitle: 'Avisos y códigos por SMS',
    title: 'SMS',
  },
];

export function IntegrationsScreen(props: {
  onBack: () => void;
  onOpenWhatsApp: () => void;
  whatsappConnection: OwnerDashboard['whatsappConnection'] | null;
}): ReactElement {
  const connection = props.whatsappConnection ?? {
    status: 'not_configured' as const,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedAt: null,
    lastStatusCheckAt: null,
    lastError: null,
  };
  const whatsappCopy = whatsappConnectionLabel(connection);

  return (
    <ScreenContent title="Integraciones">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle="Conectá los canales de tu negocio"
            title="Integraciones"
          />
        </View>
      </View>

      <Card>
        {INTEGRATIONS.map((item) => {
          if (item.id === 'whatsapp') {
            return (
              <ActionRow
                icon={item.icon}
                key={item.id}
                onPress={props.onOpenWhatsApp}
                subtitle={`${whatsappCopy.title} · ${whatsappCopy.subtitle}`}
                title={item.title}
              />
            );
          }

          return (
            <ActionRow
              disabled
              icon={item.icon}
              key={item.id}
              subtitle={`${item.subtitle} · Próximamente`}
              title={item.title}
            />
          );
        })}
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
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
});
