import type { ReactElement } from 'react';

import { OwnerAppNavigator } from '../navigation/OwnerAppNavigator';
import type { OwnerDashboard } from '../types/dashboard';

interface DashboardScreenProps {
  dashboard: OwnerDashboard;
  onSignOut: () => void;
}

export function DashboardScreen(props: DashboardScreenProps): ReactElement {
  void props.dashboard;

  return <OwnerAppNavigator onSignOut={props.onSignOut} />;
}
