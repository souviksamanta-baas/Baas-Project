import { Fragment, createElement, type ReactElement, type ReactNode } from 'react';

const featureVisibility: Record<string, boolean> = {
  accountConnectedServices: true,
  accountProfile: true,
  accountSettings: true,
  chatComposer: true,
  chatMessages: true,
  chatProfileHeader: true,
  copiComposer: true,
  copiQuickSummary: true,
  copiSuggestedQuestions: true,
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
};

export function isFeatureVisible(feature: string): boolean {
  return featureVisibility[feature] !== false;
}

export function FeatureGate(props: { children: ReactNode; feature: string }): ReactElement | null {
  return isFeatureVisible(props.feature) ? createElement(Fragment, null, props.children) : null;
}
