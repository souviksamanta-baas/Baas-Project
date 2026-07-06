import { Fragment, createElement, type ReactElement, type ReactNode } from 'react';

import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { DEFAULT_COPI_FEATURE_FLAGS } from '../types/features';

const defaultFeatureVisibility: Record<string, boolean> = {
  accountConnectedServices: true,
  accountProfile: true,
  accountSettings: true,
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
  homeAssistant: true,
  homeConversations: true,
  homeInventoryCta: true,
  homeMetrics: true,
  inboxFilters: true,
  inboxSearch: true,
  inboxTabs: true,
  moreGrowth: true,
  moreOperations: true,
  moreQuickActions: true,
  moreSettings: true,
  notificationsFilters: true,
  notificationsList: true,
  tasksScreen: true,
};

function resolveDashboardFeature(feature: string, dashboardFlags: Record<string, boolean | undefined>): boolean | undefined {
  switch (feature) {
    case 'copiComposer':
    case 'copiQuestionComposer':
    case 'copiQuickSummary':
    case 'copiSuggestedQuestions':
      return dashboardFlags.copi_enabled ?? true;
    case 'copiVoiceInput':
      return dashboardFlags.copi_voice ?? false;
    case 'copiVisionInput':
      return dashboardFlags.copi_vision ?? false;
    case 'copiCustomReports':
      return dashboardFlags.copi_custom_reports ?? false;
    case 'copiProUpsell':
      return !(dashboardFlags.copi_pro_agent ?? false);
    default:
      return undefined;
  }
}

export function useFeatureVisibility(): Record<string, boolean> {
  const { dashboard } = useOwnerSessionContext();
  const flags = {
    ...DEFAULT_COPI_FEATURE_FLAGS,
    ...(dashboard?.features ?? {}),
  };

  const resolved: Record<string, boolean> = { ...defaultFeatureVisibility };
  for (const [feature, defaultValue] of Object.entries(defaultFeatureVisibility)) {
    const dashboardValue = resolveDashboardFeature(feature, flags);
    resolved[feature] = dashboardValue ?? defaultValue;
  }

  return resolved;
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
