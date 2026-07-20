import { Slot, usePathname, useRouter } from 'expo-router';
import { useEffect, type ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MobileOverlayProvider } from '../../src/components/MobileContainedModal';
import { AppHeader, BottomNavigation } from '../../src/components/ui';
import type { AppTab } from '../../src/components/ui';
import { HeaderChromeProvider } from '../../src/context/HeaderChromeProvider';
import { InboxProvider } from '../../src/context/InboxProvider';
import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { ProductCatalogProvider } from '../../src/context/ProductCatalogProvider';
import { SellCartProvider } from '../../src/context/SellCartProvider';
import { hasSupabaseConfig } from '../../src/lib/supabase';
import {
  getActiveTab,
  routes,
  shouldHideBottomNav,
  tabRoute,
} from '../../src/navigation/routes';
import { LoadingScreen } from '../../src/screens/LoadingScreen';
import { colors } from '../../src/theme';

export default function AppLayout(): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { authPhase } = useOwnerSessionContext();

  useEffect(() => {
    if (!hasSupabaseConfig || authPhase === 'authenticated' || authPhase === 'loading') {
      return;
    }

    if (authPhase === 'onboarding') {
      router.replace(routes.authOnboarding);
      return;
    }

    if (authPhase === 'pending_verify') {
      router.replace(routes.authVerify);
      return;
    }

    router.replace(routes.authLogin);
  }, [authPhase, router]);

  if (hasSupabaseConfig && authPhase !== 'authenticated') {
    return <LoadingScreen />;
  }

  const activeTab = getActiveTab(pathname);
  const hideBottomNav = shouldHideBottomNav(pathname);

  function selectTab(tab: AppTab): void {
    router.replace(tabRoute(tab));
  }

  function openSellProducts(): void {
    router.push(routes.inventorySell);
  }

  return (
    <HeaderChromeProvider>
      <View style={[styles.root, Platform.OS === 'web' && styles.webRoot]}>
        <AppHeader
          onOpenAccount={() => {
            router.push(routes.account);
          }}
          onOpenNotifications={() => {
            router.push(routes.notifications);
          }}
        />
        <InboxProvider>
          <ProductCatalogProvider>
            <SellCartProvider>
              <MobileOverlayProvider>
                <View style={styles.content}>
                  <Slot />
                </View>
              </MobileOverlayProvider>
            </SellCartProvider>
          </ProductCatalogProvider>
        </InboxProvider>
        {hideBottomNav ? null : (
          <BottomNavigation activeTab={activeTab} onOpenSell={openSellProducts} onSelectTab={selectTab} />
        )}
      </View>
    </HeaderChromeProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
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
