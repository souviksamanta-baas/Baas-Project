import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { AccountScreen } from '../../src/screens/AccountScreen';

export default function AccountRoute(): ReactElement {
  const { signOut } = useOwnerSessionContext();

  return <AccountScreen onSignOut={signOut} />;
}
