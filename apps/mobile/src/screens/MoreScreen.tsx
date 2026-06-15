import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { menuSections } from '../api/mockData';
import { Icon } from '../components/icons';
import type { IconKind } from '../components/icons';
import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { colors } from '../theme';

export function MoreScreen(props: { onOpenAccount: () => void }): ReactElement {
  return (
    <ScreenContent>
      <ScreenTitle subtitle="Herramientas y accesos de tu negocio" title="Mas" />

      <FeatureGate feature="moreQuickActions">
        <View style={styles.quickActionRow}>
          {[
            ['report', 'Reportes'],
            ['money', 'Finanzas'],
            ['gear', 'Configuracion'],
          ].map(([icon, label]) => (
            <View key={label} style={styles.quickAction}>
              <Icon color={colors.primary} kind={icon as IconKind} size={16} strokeWidth={1.8} />
              <Text style={styles.quickActionText}>{label}</Text>
            </View>
          ))}
        </View>
      </FeatureGate>

      {menuSections.map((section) => (
        <FeatureGate
          feature={
            section.id === 'operations'
              ? 'moreOperations'
              : section.id === 'growth'
                ? 'moreGrowth'
                : 'moreSettings'
          }
          key={section.id}
        >
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card>
              {section.rows.map((row) => (
                <ActionRow
                  icon={row.icon as IconKind}
                  key={row.id}
                  onPress={row.id === 'account' ? props.onOpenAccount : undefined}
                  subtitle={row.subtitle}
                  title={row.title}
                />
              ))}
            </Card>
          </View>
        </FeatureGate>
      ))}
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  quickAction: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 31,
    justifyContent: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionText: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
});
