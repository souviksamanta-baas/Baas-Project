import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../../src/navigation/routes';
import { MoreScreen } from '../../../src/screens/MoreScreen';

export default function MoreRoute(): ReactElement {
  const router = useRouter();

  return (
    <MoreScreen
      onOpenAccount={() => router.push(routes.account)}
      onOpenInventory={() => router.push(routes.inventoryManageStock)}
    />
  );
}
