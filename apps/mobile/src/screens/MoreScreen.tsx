import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import { moreMenuSections, type MoreMenuRowId } from '../lib/moreMenu';
import { colors } from '../theme';

export function MoreScreen(props: {
  onOpenRow: (rowId: MoreMenuRowId) => void;
}): ReactElement {
  return (
    <ScreenContent title="Más">
      <ScreenTitle subtitle="Herramientas y accesos de tu negocio" title="Más" />

      {moreMenuSections.map((section) => (
        <FeatureGate feature={section.feature} key={section.id}>
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card>
              {section.rows.length === 0 ? (
                <Text style={styles.emptyText}>
                  {section.emptyMessage ?? 'Próximamente.'}
                </Text>
              ) : (
                section.rows.map((row) => (
                  <ActionRow
                    disabled={row.disabled === true}
                    icon={row.icon}
                    key={row.id}
                    onPress={row.disabled ? undefined : () => props.onOpenRow(row.id)}
                    subtitle={row.subtitle}
                    title={row.title}
                  />
                ))
              )}
            </Card>
          </View>
        </FeatureGate>
      ))}
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
});
