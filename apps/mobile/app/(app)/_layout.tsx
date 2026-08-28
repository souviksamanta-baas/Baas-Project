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
import { OwnerTasksProvider, useOwnerTasks } from '../../src/context/OwnerTasksProvider';
import { ProductCatalogProvider } from '../../src/context/ProductCatalogProvider';
import { SellCartProvider } from '../../src/context/SellCartProvider';
import { useAndroidKeyboardVisible } from '../../src/hooks/useAndroidKeyboard';
import { useAndroidRootExitBack } from '../../src/hooks/useAndroidUnsavedBack';
import { usePushNotificationRouting } from '../../src/hooks/usePushNotificationRouting';
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
import { LoadingScreen } from '../../src/screens/LoadingScreen';
import { colors } from '../../src/theme';

export default function AppLayout(): ReactElement {
  return (
    <HeaderChromeProvider>
      <OwnerTasksProvider>
        <AuthenticatedAppShell />
      </OwnerTasksProvider>
    </HeaderChromeProvider>
  );
}

function AuthenticatedAppShell(): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { authPhase, dashboard } = useOwnerSessionContext();
  const androidKeyboardVisible = useAndroidKeyboardVisible();
  const tasksState = useOwnerTasks();
  usePushNotificationRouting(Boolean(hasSupabaseConfig) && authPhase === 'authenticated');

  const routeHidesBottomNav = shouldHideBottomNav(pathname);
  // Android edge-to-edge: hide the tab bar while typing so it doesn’t sit under the
  // keyboard and steal space from the scrollable form.
  const hideBottomNav = routeHidesBottomNav || androidKeyboardVisible;
  const isAuthenticatedShell = !hasSupabaseConfig || authPhase === 'authenticated';

  // Must stay above any early return — authPhase flips after eliminar/archivar negocio.
  useAndroidRootExitBack(isAuthenticatedShell && !routeHidesBottomNav);

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
    <View style={[styles.root, Platform.OS === 'web' && styles.webRoot]}>
      <AppHeader
        onOpenAccount={() => {
          router.push(routes.account);
        }}
        onOpenNotifications={() => {
          router.push(routes.notifications);
        }}
        unreadNotificationCount={tasksState.unreadNotificationCount}
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
