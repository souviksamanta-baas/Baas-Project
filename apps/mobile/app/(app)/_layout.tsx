import { Redirect, Slot, usePathname, useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { branches, ownerProfile } from '../../src/api/mockData';
import { AppHeader, BottomNavigation } from '../../src/components/ui';
import type { AppTab } from '../../src/components/ui';
import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { hasSupabaseConfig } from '../../src/lib/supabase';
import {
  getActiveTab,
  routes,
  shouldHideBottomNav,
  tabRoute,
} from '../../src/navigation/routes';
import { colors } from '../../src/theme';

export default function AppLayout(): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { authPhase } = useOwnerSessionContext();
  const [showBranches, setShowBranches] = useState(false);

  if (hasSupabaseConfig && authPhase !== 'authenticated') {
    return <Redirect href="/" />;
  }

  const activeTab = getActiveTab(pathname);
  const hideBottomNav = shouldHideBottomNav(pathname);

  function selectTab(tab: AppTab): void {
    setShowBranches(false);
    router.replace(tabRoute(tab));
  }

  function openSellProducts(): void {
    setShowBranches(false);
    router.push(routes.inventorySell);
  }

  return (
    <View style={[styles.root, Platform.OS === 'web' && styles.webRoot]}>
      <AppHeader
        activeBranch={ownerProfile.activeBranch}
        branches={branches}
        onOpenAccount={() => {
          setShowBranches(false);
          router.push(routes.account);
        }}
        onOpenNotifications={() => {
          setShowBranches(false);
          router.push(routes.notifications);
        }}
        onToggleBranches={() => setShowBranches((current) => !current)}
        showBranches={showBranches}
      />
      <View style={styles.content}>
        <Slot />
      </View>
      {hideBottomNav ? null : (
        <BottomNavigation activeTab={activeTab} onOpenSell={openSellProducts} onSelectTab={selectTab} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 0,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  webRoot: {
    alignSelf: 'center',
    maxWidth: 393,
    width: '100%',
  },
});
