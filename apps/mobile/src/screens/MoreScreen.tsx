import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import {
  buildAccountMenuRows,
  filterMoreMenuSections,
  type AccountMenuActionId,
  type MoreMenuRowId,
} from '../lib/moreMenu';
import { useOrganizationFlags } from '../hooks/useFeatureVisibility';
import { colors } from '../theme';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'NX';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function MoreScreen(props: {
  avatarUrl: string | null;
  businessName: string | null;
  canManageBusiness: boolean;
  fullName: string;
  onAccountAction: (actionId: AccountMenuActionId) => void;
  onOpenRow: (rowId: MoreMenuRowId) => void;
  timezoneLabel: string;
  whatsappSubtitle: string;
  whatsappTitle: string;
}): ReactElement {
  const [accountOpen, setAccountOpen] = useState(false);
  const flags = useOrganizationFlags();
  const sections = useMemo(() => filterMoreMenuSections(flags), [flags]);
  const displayName = props.fullName.trim() || 'Tu nombre';
  const initials = initialsFromName(displayName);
  const accountRows = useMemo(
    () =>
      buildAccountMenuRows({
        canManageBusiness: props.canManageBusiness,
        timezoneLabel: props.timezoneLabel,
        whatsappSubtitle: props.whatsappSubtitle,
        whatsappTitle: props.whatsappTitle,
      }),
    [
      props.canManageBusiness,
      props.timezoneLabel,
      props.whatsappSubtitle,
      props.whatsappTitle,
    ],
  );

  return (
    <ScreenContent title="Más">
      <ScreenTitle title="Más" />

      <FeatureGate feature="accountProfile">
        <Card flush>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAccountOpen((open) => !open)}
            style={[styles.profileRow, accountOpen && styles.profileRowOpen]}
          >
            {props.avatarUrl ? (
              <Image source={{ uri: props.avatarUrl }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <Text style={styles.profileInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.profileText}>
              <Text numberOfLines={1} style={styles.profileName}>
                {displayName}
              </Text>
              <Text numberOfLines={1} style={styles.profileSubtitle}>
                {props.businessName ?? 'Tu negocio'}
              </Text>
            </View>
            <Text style={styles.profileChevron}>{accountOpen ? '⌃' : '⌄'}</Text>
          </Pressable>

          {accountOpen
            ? accountRows.map((row, index) => (
                <ActionRow
                  danger={row.danger}
                  disabled={row.disabled}
                  icon={row.icon}
                  key={`${row.id}-${row.title}`}
                  onPress={row.disabled ? undefined : () => props.onAccountAction(row.id)}
                  showDivider={index < accountRows.length - 1}
                  subtitle={row.subtitle}
                  title={row.title}
                />
              ))
            : null}
        </Card>
      </FeatureGate>

      {sections.map((section) => (
        <FeatureGate feature={section.feature} key={section.id}>
          <Card flush>
            {section.rows.map((row, index) => (
              <ActionRow
                disabled={row.disabled === true}
                icon={row.icon}
                key={row.id}
                onPress={row.disabled ? undefined : () => props.onOpenRow(row.id)}
                showDivider={index < section.rows.length - 1}
                title={row.title}
              />
            ))}
          </Card>
        </FeatureGate>
      ))}
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  profileAvatar: {
    borderRadius: 999,
    height: 64,
    width: 64,
  },
  profileAvatarFallback: {
    alignItems: 'center',
    backgroundColor: '#dfaa8b',
    borderRadius: 999,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  profileChevron: {
    color: colors.slateLight,
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
    paddingHorizontal: 4,
  },
  profileInitials: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '600',
  },
  profileName: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  profileRowOpen: {
    borderBottomColor: 'rgba(60, 60, 67, 0.18)',
    borderBottomWidth: 1,
  },
  profileSubtitle: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 2,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
});
