import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { EditProfileScreen } from '../../src/screens/EditProfileScreen';

export default function EditProfileRoute(): ReactElement {
  const router = useRouter();

  return <EditProfileScreen onBack={() => router.back()} />;
}
