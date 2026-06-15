import { useMemo, useState, type ReactElement } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { branches, conversations, ownerProfile } from '../api/mockData';
import { AppHeader, BottomNavigation } from '../components/ui';
import type { AppTab } from '../components/ui';
import { AccountScreen } from '../screens/AccountScreen';
import { CopiChatScreen, CopiScreen } from '../screens/CopiScreen';
import { ConversationDetailScreen, InboxScreen } from '../screens/InboxScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { colors } from '../theme';

type OwnerRoute = AppTab | 'account' | 'copi-chat' | 'conversation' | 'notifications';

export function OwnerAppNavigator(props: { onSignOut: () => void }): ReactElement {
  const [route, setRoute] = useState<OwnerRoute>('home');
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedConversationId, setSelectedConversationId] = useState(conversations[0].id);
  const [showBranches, setShowBranches] = useState(false);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0],
    [selectedConversationId],
  );
  const hideBottomNav = route === 'conversation' || route === 'copi-chat';

  function selectTab(tab: AppTab): void {
    setActiveTab(tab);
    setRoute(tab);
    setShowBranches(false);
  }

  function openConversation(conversationId: string): void {
    setSelectedConversationId(conversationId);
    setRoute('conversation');
    setShowBranches(false);
  }

  return (
    <View style={[styles.root, Platform.OS === 'web' && styles.webRoot]}>
      <AppHeader
        activeBranch={ownerProfile.activeBranch}
        branches={branches}
        onOpenAccount={() => setRoute('account')}
        onOpenNotifications={() => setRoute('notifications')}
        onToggleBranches={() => setShowBranches((current) => !current)}
        showBranches={showBranches}
      />
      {route === 'conversation' ? (
        <ConversationDetailScreen conversation={selectedConversation} onBack={() => selectTab('inbox')} />
      ) : route === 'copi-chat' ? (
        <CopiChatScreen onBack={() => selectTab('copi')} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
          {route === 'home' ? (
            <HomeScreen onSelectTab={selectTab} />
          ) : route === 'inbox' ? (
            <InboxScreen onOpenConversation={openConversation} />
          ) : route === 'copi' ? (
            <CopiScreen onOpenChat={() => setRoute('copi-chat')} />
          ) : route === 'notifications' ? (
            <NotificationsScreen />
          ) : route === 'account' ? (
            <AccountScreen onSignOut={props.onSignOut} />
          ) : (
            <MoreScreen onOpenAccount={() => setRoute('account')} />
          )}
        </ScrollView>
      )}
      {hideBottomNav ? null : <BottomNavigation activeTab={activeTab} onSelectTab={selectTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  webRoot: {
    alignSelf: 'center',
    maxWidth: 393,
    width: '100%',
  },
});
