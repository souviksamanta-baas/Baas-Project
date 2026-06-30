import { useMemo, useState, type ReactElement } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { branches, conversations, ownerProfile } from '../api/mockData';
import { AppHeader, BottomNavigation } from '../components/ui';
import type { AppTab } from '../components/ui';
import { AccountScreen } from '../screens/AccountScreen';
import { CopiChatScreen, CopiScreen } from '../screens/CopiScreen';
import { ConversationDetailScreen, InboxScreen } from '../screens/InboxScreen';
import { HomeScreen } from '../screens/HomeScreen';
import {
  AddStockScreen,
  ConfirmPaymentScreen,
  DeleteProductScreen,
  EditProductScreen,
  EditSubproductScreen,
  ManageStockScreen,
  ProductDetailScreen,
  SellProductsScreen,
} from '../screens/inventory/InventoryScreens';
import { MoreScreen } from '../screens/MoreScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import type { InboxConversationSummary } from '../types/messages';
import type { OwnerDashboard } from '../types/dashboard';
import { colors } from '../theme';

const legacyWhatsAppConnection: OwnerDashboard['whatsappConnection'] = {
  status: 'connected',
  phoneNumberId: null,
  displayPhoneNumber: '+54 9 11 6000-0000',
  verifiedAt: null,
  lastStatusCheckAt: null,
  lastError: null,
};

const legacyInboxConversations: InboxConversationSummary[] = conversations.map((conversation) => ({
  contact: {
    displayName: conversation.customerName,
    id: conversation.id,
    leadStatus: 'new',
    phoneNumber: null,
  },
  externalContactId: conversation.id,
  id: conversation.id,
  lastMessageAt: null,
  latestMessage: {
    body: conversation.preview,
    conversationId: conversation.id,
    createdAt: new Date().toISOString(),
    direction: 'inbound',
    id: `${conversation.id}-preview`,
    messageStatus: 'received',
    recipientPhone: null,
    senderPhone: null,
  },
  status: 'open',
}));

export type InventoryRoute =
  | 'add-stock'
  | 'confirm-payment'
  | 'delete-product'
  | 'edit-product'
  | 'edit-subproduct'
  | 'manage-stock'
  | 'product-detail'
  | 'sell-products';

type OwnerRoute = AppTab | 'account' | 'copi-chat' | 'conversation' | 'notifications' | InventoryRoute;

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
  const inventoryNav = {
    onOpenAddStock: () => setRoute('add-stock'),
    onOpenConfirmPayment: () => setRoute('confirm-payment'),
    onOpenDeleteProduct: () => setRoute('delete-product'),
    onOpenEditProduct: () => setRoute('edit-product'),
    onOpenEditSubproduct: (subproductId: string) => setRoute('edit-subproduct'),
    onOpenProductDetail: (_productId: string) => setRoute('product-detail'),
    onOpenSellProducts: () => setRoute('sell-products'),
  };

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

  function openManageStock(): void {
    setRoute('manage-stock');
    setShowBranches(false);
  }

  function openSellProducts(): void {
    setRoute('sell-products');
    setShowBranches(false);
  }

  function renderInventoryScreen(): ReactElement | null {
    switch (route) {
      case 'manage-stock':
        return <ManageStockScreen {...inventoryNav} />;
      case 'product-detail':
        return <ProductDetailScreen {...inventoryNav} onBack={() => setRoute('manage-stock')} />;
      case 'edit-product':
        return <EditProductScreen {...inventoryNav} onBack={() => setRoute('product-detail')} />;
      case 'edit-subproduct':
        return <EditSubproductScreen onBack={() => setRoute('product-detail')} />;
      case 'add-stock':
        return <AddStockScreen onBack={() => setRoute('product-detail')} />;
      case 'delete-product':
        return <DeleteProductScreen onBack={() => setRoute('product-detail')} />;
      case 'sell-products':
        return <SellProductsScreen {...inventoryNav} />;
      case 'confirm-payment':
        return <ConfirmPaymentScreen onBack={() => setRoute('sell-products')} />;
      default:
        return null;
    }
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
        <ConversationDetailScreen
          customerName={selectedConversation.customerName}
          isLoading={false}
          messages={selectedConversation.messages.map((message) => ({
            body: message.text,
            conversationId: selectedConversation.id,
            createdAt: new Date().toISOString(),
            direction: message.direction,
            id: message.id,
            messageStatus: message.direction === 'outbound' ? 'sent' : 'received',
            recipientPhone: null,
            senderPhone: null,
          }))}
          onBack={() => selectTab('inbox')}
          statusLabel={selectedConversation.statusLabel}
          threadAvatar={selectedConversation.avatar}
        />
      ) : route === 'copi-chat' ? (
        <CopiChatScreen onBack={() => selectTab('copi')} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
          {renderInventoryScreen() ??
            (route === 'home' ? (
              <HomeScreen
                conversations={legacyInboxConversations}
                metrics={null}
                onOpenConversation={openConversation}
                onOpenManageStock={openManageStock}
                onOpenNotifications={() => setRoute('notifications')}
                onOpenWhatsAppSetup={() => setRoute('account')}
                onSelectTab={selectTab}
                ownerGreeting="Hola!"
                whatsappConnection={legacyWhatsAppConnection}
              />
            ) : route === 'inbox' ? (
              <InboxScreen
                conversations={legacyInboxConversations}
                errorMessage={null}
                isLoading={false}
                onOpenConversation={openConversation}
                onOpenWhatsAppSetup={() => setRoute('account')}
                whatsappConnection={legacyWhatsAppConnection}
              />
            ) : route === 'copi' ? (
              <CopiScreen onOpenChat={() => setRoute('copi-chat')} />
            ) : route === 'notifications' ? (
              <NotificationsScreen />
            ) : route === 'account' ? (
              <AccountScreen
                businessCenterName={ownerProfile.activeBranch}
                businessName={ownerProfile.businessName}
                onOpenStaffInvite={() => undefined}
                onOpenWhatsAppSetup={() => setRoute('account')}
                onSignOut={props.onSignOut}
                role="owner"
                whatsappConnection={legacyWhatsAppConnection}
              />
            ) : (
              <MoreScreen onOpenAccount={() => setRoute('account')} onOpenInventory={openManageStock} />
            ))}
        </ScrollView>
      )}
      {hideBottomNav ? null : (
        <BottomNavigation activeTab={activeTab} onOpenSell={openSellProducts} onSelectTab={selectTab} />
      )}
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
