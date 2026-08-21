import { Fragment, createElement, type ReactElement, type ReactNode } from 'react';

import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import {
  resolveOrganizationFeatureFlags,
  type OrganizationFeatureFlags,
} from '../types/features';

const defaultFeatureVisibility: Record<string, boolean> = {
  accountConnectedServices: true,
  accountProfile: true,
  accountSettings: true,
  appointmentsScreen: false,
  chatComposer: true,
  chatMessages: true,
  chatProfileHeader: true,
  copiComposer: true,
  copiCustomReports: false,
  copiProUpsell: true,
  copiQuestionComposer: true,
  copiQuickSummary: true,
  copiSuggestedQuestions: true,
  copiVisionInput: false,
  copiVoiceInput: false,
  homeAlerts: true,
  homeAppointments: false,
  homeAssistant: true,
  homeConversations: true,
  homeInventoryCta: true,
  homeMetrics: true,
  inboxFilters: true,
  inboxSearch: true,
  inboxTabs: true,
  moreInventory: true,
  moreOperations: true,
  moreQuickActions: false,
  moreReports: true,
  moreSettings: true,
  notificationsFilters: true,
  notificationsList: true,
  tasksScreen: true,
};

function mapOrgFlagsToVisibility(
  flags: Required<OrganizationFeatureFlags>,
): Record<string, boolean> {
  return {
    accountConnectedServices: flags.account,
    accountProfile: flags.account,
    accountSettings: flags.account,
    appointmentsScreen: flags.appointments,
    chatComposer: flags.inbox,
    chatMessages: flags.inbox,
    chatProfileHeader: flags.inbox,
    copiComposer: flags.copi_enabled,
    copiCustomReports: flags.copi_custom_reports,
    copiProUpsell: !flags.copi_pro_agent,
    copiQuestionComposer: flags.copi_enabled,
    copiQuickSummary: flags.copi_enabled,
    copiSuggestedQuestions: flags.copi_enabled,
    copiVisionInput: flags.copi_vision,
    copiVoiceInput: flags.copi_voice,
    homeAlerts: flags.notifications || flags.tasks,
    homeAppointments: flags.appointments,
    homeAssistant: flags.copi_enabled,
    homeConversations: flags.inbox,
    homeInventoryCta: flags.commerce_inventory,
    homeMetrics: true,
    inboxFilters: flags.inbox,
    inboxSearch: flags.inbox,
    inboxTabs: flags.inbox,
    moreInventory:
      flags.commerce_inventory ||
      flags.commerce_lots ||
      flags.commerce_pos ||
      flags.commerce_purchases,
    moreOperations:
      flags.commerce_purchases ||
      flags.billing_quotes ||
      flags.billing_invoices ||
      flags.billing_cash ||
      flags.appointments,
    moreQuickActions: false,
    moreReports: false,
    moreSettings: true,
    notificationsFilters: flags.notifications,
    notificationsList: flags.notifications,
    tasksScreen: flags.tasks,
  };
}

export function useFeatureVisibility(): Record<string, boolean> {
  const { dashboard } = useOwnerSessionContext();
  const flags = resolveOrganizationFeatureFlags(dashboard?.features ?? null);
  return {
    ...defaultFeatureVisibility,
    ...mapOrgFlagsToVisibility(flags),
  };
}

export function useOrganizationFlags(): Required<OrganizationFeatureFlags> {
  const { dashboard } = useOwnerSessionContext();
  return resolveOrganizationFeatureFlags(dashboard?.features ?? null);
}

export function isFeatureVisible(feature: string, visibility?: Record<string, boolean>): boolean {
  const map = visibility ?? defaultFeatureVisibility;
  return map[feature] !== false;
}

export function FeatureGate(props: {
  children: ReactNode;
  feature: string;
  visibility?: Record<string, boolean>;
}): ReactElement | null {
  return isFeatureVisible(props.feature, props.visibility)
    ? createElement(Fragment, null, props.children)
    : null;
}

export function useFeatureGate(feature: string): boolean {
  const visibility = useFeatureVisibility();
  return isFeatureVisible(feature, visibility);
}
