import { Slot, usePathname, useRouter } from 'expo-router';
import { useEffect, type ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MobileOverlayProvider } from '../../src/components/MobileContainedModal';
import { AppHeader, BottomNavigation } from '../../src/components/ui';
import type { AppTab } from '../../src/components/ui';
import { HeaderChromeProvider } from '../../src/context/HeaderChromeProvider';
import { InboxProvider } from '../../src/context/InboxProvider';
import { LoadPurchaseProvider } from '../../src/context/LoadPurchaseProvider';
import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { ProductCatalogProvider } from '../../src/context/ProductCatalogProvider';
import { SellCartProvider } from '../../src/context/SellCartProvider';
import { hasSupabaseConfig } from '../../src/lib/supabase';
import {
  getNavShortcutOption,
  isNavShortcutActive,
  resolveNavShortcutRoute,
} from '../../src/lib/navShortcut';
import {
  getActiveTab,
  routes,
  shouldHideBottomNav,
  tabRoute,
} from '../../src/navigation/routes';
import { useAndroidRootExitBack } from '../../src/hooks/useAndroidUnsavedBack';
import { LoadingScreen } from '../../src/screens/LoadingScreen';
import { colors } from '../../src/theme';

export default function AppLayout(): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { authPhase, dashboard } = useOwnerSessionContext();

  const hideBottomNav = shouldHideBottomNav(pathname);
  const isAuthenticatedShell = !hasSupabaseConfig || authPhase === 'authenticated';

  // Must stay above any early return — authPhase flips after eliminar/archivar negocio.
  useAndroidRootExitBack(isAuthenticatedShell && !hideBottomNav);

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

    router.replace(routes.authWelcome);
  }, [authPhase, router]);

  if (!isAuthenticatedShell) {
    return <LoadingScreen />;
  }

  const activeTab = getActiveTab(pathname);

  const shortcut = getNavShortcutOption(dashboard?.organization?.navShortcut);
  const shortcutActive = isNavShortcutActive(pathname, shortcut.id);

  function selectTab(tab: AppTab): void {
    router.replace(tabRoute(tab));
  }

  function openShortcut(): void {
    const route = resolveNavShortcutRoute(shortcut.id);
    if (!route) {
      return;
    }
    router.push(route);
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
              <LoadPurchaseProvider>
                <MobileOverlayProvider>
                  <View style={styles.content}>
                    <Slot />
                  </View>
                </MobileOverlayProvider>
              </LoadPurchaseProvider>
            </SellCartProvider>
          </ProductCatalogProvider>
        </InboxProvider>
        {hideBottomNav ? null : (
          <BottomNavigation
            activeTab={activeTab}
            onOpenShortcut={openShortcut}
            onSelectTab={selectTab}
            shortcutActive={shortcutActive}
            shortcutIcon={shortcut.icon}
            shortcutIsCash={shortcut.id === 'ventas'}
            shortcutLabel={shortcut.label}
          />
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
