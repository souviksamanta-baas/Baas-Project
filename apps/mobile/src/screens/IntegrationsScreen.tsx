import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconKind } from '../components/icons';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { useOrganizationFlags } from '../hooks/useFeatureVisibility';
import { colors } from '../theme';
import type { OwnerDashboard } from '../types/dashboard';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';

type IntegrationId = 'whatsapp' | 'instagram' | 'facebook' | 'email' | 'sms';

const INTEGRATIONS: Array<{
  comingSoon?: boolean;
  flag?:
    | 'integrations_whatsapp'
    | 'integrations_instagram'
    | 'integrations_messenger'
    | 'integrations_email'
    | 'integrations_sms';
  icon: IconKind;
  id: IntegrationId;
  subtitle: string;
  title: string;
}> = [
  {
    flag: 'integrations_whatsapp',
    icon: 'whatsapp',
    id: 'whatsapp',
    subtitle: 'Chats y mensajes con clientes',
    title: 'WhatsApp Business',
  },
  {
    flag: 'integrations_instagram',
    icon: 'instagram',
    id: 'instagram',
    subtitle: 'Mensajes directos de Instagram',
    title: 'Instagram',
  },
  {
    flag: 'integrations_messenger',
    icon: 'facebook',
    id: 'facebook',
    subtitle: 'Mensajes de tu página en Messenger',
    title: 'Facebook Messenger',
  },
  {
    comingSoon: true,
    flag: 'integrations_email',
    icon: 'email',
    id: 'email',
    subtitle: 'Correo transaccional y campañas',
    title: 'Email',
  },
  {
    comingSoon: true,
    flag: 'integrations_sms',
    icon: 'message',
    id: 'sms',
    subtitle: 'Avisos y códigos por SMS',
    title: 'SMS',
  },
];

export function IntegrationsScreen(props: {
  onBack: () => void;
  onOpenFacebook: () => void;
  onOpenInstagram: () => void;
  onOpenWhatsApp: () => void;
  facebookConnection?: OwnerDashboard['facebookConnection'] | null;
  instagramConnection?: OwnerDashboard['instagramConnection'] | null;
  whatsappConnection: OwnerDashboard['whatsappConnection'] | null;
}): ReactElement {
  const flags = useOrganizationFlags();
  const connection = props.whatsappConnection ?? {
    status: 'not_configured' as const,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedAt: null,
    lastStatusCheckAt: null,
    lastError: null,
  };
  const whatsappCopy = whatsappConnectionLabel(connection);
  const ig = props.instagramConnection;
  const igSubtitle =
    ig?.status === 'connected'
      ? `Conectado · ${ig.igUsername ? `@${ig.igUsername}` : ig.igUserId ?? 'cuenta'}`
      : 'Mensajes directos de Instagram';
  const fb = props.facebookConnection;
  const fbSubtitle =
    fb?.status === 'connected'
      ? `Conectado · ${fb.pageName ?? fb.pageId ?? 'página'}`
      : 'Mensajes de tu página en Messenger';

  return (
    <ScreenContent title="Integraciones">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Integraciones" />
        </View>
      </View>

      <Card>
        {INTEGRATIONS.filter((item) => !item.flag || flags[item.flag] === true).map((item) => {
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

          if (item.id === 'instagram') {
            return (
              <ActionRow
                icon={item.icon}
                key={item.id}
                onPress={props.onOpenInstagram}
                subtitle={igSubtitle}
                title={item.title}
              />
            );
          }

          if (item.id === 'facebook') {
            return (
              <ActionRow
                icon={item.icon}
                key={item.id}
                onPress={props.onOpenFacebook}
                subtitle={fbSubtitle}
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
