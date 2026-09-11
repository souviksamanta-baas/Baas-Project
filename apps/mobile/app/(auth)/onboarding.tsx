import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../src/navigation/routes';

/** Legacy route — signed-in users without a business now use the welcome screen. */
export default function OnboardingRoute(): ReactElement {
  return <Redirect href={routes.authWelcome} />;
}
