/**
 * LEGACY / UNREACHABLE under Expo Router (`main`: expo-router/entry).
 * Kept only for static review / accidental imports; do not add new screens here.
 * Production navigation lives under apps/mobile/app/.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { branches, conversations, ownerProfile } from '../api/mockData';
import { baseProduct } from '../api/inventoryMockData';
import { AppHeader, BottomNavigation } from '../components/ui';
import type { AppTab } from '../components/ui';
import { AccountScreen } from '../screens/AccountScreen';
import { CopiChatScreen, CopiScreen, type CopiComposerActions } from '../screens/CopiScreen';
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
import { useOwnerCopilot } from '../hooks/useOwnerCopilot';
import type { InboxConversationSummary } from '../types/messages';
import type { OwnerDashboard } from '../types/dashboard';
import type { Product } from '../types/products';
import { SellCartProvider } from '../context/SellCartProvider';
import { DEFAULT_BASE_PRODUCT_ID } from './routes';
import { colors } from '../theme';

const legacyCopiComposer: CopiComposerActions = {
  attachmentMenuOpen: false,
  canUseVision: false,
  canUseVoice: false,
  isAnalyzingImage: false,
  isRecordingVoice: false,
  isTranscribingVoice: false,
  onClearPendingImage: () => undefined,
  onPressAttachCamera: () => undefined,
  onPressAttachLibrary: () => undefined,
  onPressPlus: () => undefined,
  onPressVoice: () => undefined,
  pendingImageUri: null,
};

const legacyWhatsAppConnection: OwnerDashboard['whatsappConnection'] = {
  status: 'connected',
  phoneNumberId: null,
  displayPhoneNumber: '+54 9 11 6000-0000',
  verifiedAt: null,
  lastStatusCheckAt: null,
  lastError: null,
};

const legacyInboxConversations: InboxConversationSummary[] = conversations.map((conversation) => ({
  channel: conversation.channel,
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

const legacyEditProduct: Product = {
  baseUnitCode: 'kg',
  category: baseProduct.category,
  currency: 'USD',
  description: baseProduct.notes,
  id: DEFAULT_BASE_PRODUCT_ID,
  inventoryItemId: null,
  baseUnitEquivalent: null,
  isActive: true,
  isLowStock: false,
  metadata: {
    categoria: baseProduct.category,
    estado: 'en_stock',
    margen_pct: 34,
    precio_costo_cents: 125000,
  },
  name: baseProduct.name,
  organizationId: 'legacy',
  parentProductId: null,
  productType: null,
  reorderThreshold: 0,
  sku: baseProduct.sku,
  stockQuantity: 100,
  unitCode: 'kg',
  unitPriceCents: 190000,
};

export function OwnerAppNavigator(props: { onSignOut: () => void }): ReactElement {
  const [route, setRoute] = useState<OwnerRoute>('home');
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedConversationId, setSelectedConversationId] = useState(conversations[0].id);
  const [showBranches, setShowBranches] = useState(false);
  const [copiDraft, setCopiDraft] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(DEFAULT_BASE_PRODUCT_ID);
  const [selectedSubproductId, setSelectedSubproductId] = useState('s1');
  const legacyCopilot = useOwnerCopilot({ businessCenterId: null, organizationId: null });

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0],
    [selectedConversationId],
  );
  const hideBottomNav = route === 'conversation' || route === 'copi-chat';
  const inventoryNav = {
    onAddStock: () => setRoute('add-stock'),
    onAddStockForProduct: (productId: string) => openProductFlow(productId, 'add-stock'),
    onDeleteProductById: (productId: string) => openProductFlow(productId, 'delete-product'),
    onOpenAddSubproduct: () => setRoute('edit-subproduct'),
    onOpenConfirmPayment: () => setRoute('confirm-payment'),
    onOpenDeleteProduct: () => setRoute('delete-product'),
    onOpenEditProduct: () => setRoute('edit-product'),
    onOpenEditSubproduct: (subproductId: string) => {
      setSelectedSubproductId(subproductId);
      setRoute('edit-subproduct');
    },
    onOpenProductDetail: (productId: string) => {
      setSelectedProductId(productId);
      setRoute('product-detail');
    },
    onOpenSellProducts: () => setRoute('sell-products'),
  };

  function openProductFlow(productId: string, nextRoute: InventoryRoute): void {
    setSelectedProductId(productId);
    setRoute(nextRoute);
  }

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
        return (
          <ManageStockScreen
            onAddStockProduct={(productId) => openProductFlow(productId, 'add-stock')}
            onDeleteProduct={(productId) => openProductFlow(productId, 'delete-product')}
            onEditProduct={(productId) => openProductFlow(productId, 'edit-product')}
            onOpenProductDetail={(productId) => openProductFlow(productId, 'product-detail')}
          />
        );
      case 'product-detail':
        return <ProductDetailScreen {...inventoryNav} onBack={() => setRoute('manage-stock')} />;
      case 'edit-product':
        return (
          <EditProductScreen
            businessCenterId="legacy"
            businessCenters={[{ id: 'legacy', name: ownerProfile.activeBranch }]}
            categories={[baseProduct.category]}
            onBack={() => setRoute('manage-stock')}
            onOpenAddSubproduct={() => setRoute('edit-subproduct')}
            onOpenDeleteProduct={() => setRoute('delete-product')}
            onOpenEditSubproduct={() => setRoute('edit-subproduct')}
            onOpenSubproductDetail={() => setRoute('product-detail')}
            onSave={async () => {
              setRoute('manage-stock');
            }}
            product={{ ...legacyEditProduct, id: selectedProductId }}
            subproducts={[]}
          />
        );
      case 'edit-subproduct':
        return (
          <EditSubproductScreen
            businessCenterId="legacy"
            businessCenters={[{ id: 'legacy', name: ownerProfile.activeBranch }]}
            categories={[baseProduct.category]}
            onBack={() => setRoute('product-detail')}
            onSave={async () => {
              setRoute('product-detail');
            }}
            parentProduct={{ ...legacyEditProduct, id: selectedProductId }}
            subproduct={{
              ...legacyEditProduct,
              id: 'legacy-subproduct',
              name: 'Harina 1 kg',
              parentProductId: selectedProductId,
            }}
          />
        );
      case 'add-stock':
        return (
          <AddStockScreen
            catalogProducts={[{ ...legacyEditProduct, id: selectedProductId }]}
            defaultSelectedProductId={selectedProductId}
            onBack={() => setRoute('manage-stock')}
            onSave={async () => {
              setRoute('manage-stock');
            }}
            onSaveAndGoToManageStock={async () => {
              setRoute('manage-stock');
            }}
            selectableProducts={[{ ...legacyEditProduct, id: selectedProductId }]}
            showProductSelection={false}
          />
        );
      case 'delete-product':
        return (
          <DeleteProductScreen
            onBack={() => setRoute('manage-stock')}
            onDeactivate={() => setRoute('edit-product')}
            onDelete={() => setRoute('manage-stock')}
            product={{ ...legacyEditProduct, id: selectedProductId }}
          />
        );
      case 'sell-products':
        return (
          <SellCartProvider>
            <SellProductsScreen
              onAddToCart={() => undefined}
              onEditProduct={() => undefined}
              onOpenConfirmPayment={() => setRoute('confirm-payment')}
              onOpenProductDetail={() => undefined}
            />
          </SellCartProvider>
        );
      case 'confirm-payment':
        return (
          <SellCartProvider>
            <ConfirmPaymentScreen onBack={() => setRoute('sell-products')} />
          </SellCartProvider>
        );
      default:
        return null;
    }
  }

  return (
    <View style={[styles.root, Platform.OS === 'web' && styles.webRoot]}>
      <AppHeader
        onOpenAccount={() => setRoute('account')}
        onOpenNotifications={() => setRoute('notifications')}
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
        <CopiChatScreen
          composer={legacyCopiComposer}
          copilot={legacyCopilot}
          onBack={() => selectTab('copi')}
          onSend={async () => undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
          {renderInventoryScreen() ??
            (route === 'home' ? (
              <HomeScreen
                conversations={legacyInboxConversations}
                metrics={null}
                notifications={[]}
                onOpenAlertProduct={() => undefined}
                onOpenConversation={openConversation}
                onOpenLowStock={() => undefined}
                onOpenManageStock={openManageStock}
                onOpenNotifications={() => setRoute('notifications')}
                onOpenTaskDetail={() => undefined}
                onOpenTasks={() => undefined}
                onOpenWhatsAppSetup={() => setRoute('account')}
                onSelectTab={selectTab}
                ownerGreeting="Hola!"
                tasks={[]}
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
              <CopiScreen
                composer={legacyCopiComposer}
                metrics={null}
                onAskQuestion={async () => undefined}
                onOpenChat={() => setRoute('copi-chat')}
                onResolveImageAsk={async (draft) => ({ question: draft.trim() || 'Hola' })}
                questionDraft={copiDraft}
                setQuestionDraft={setCopiDraft}
              />
            ) : route === 'notifications' ? (
              <NotificationsScreen
                notifications={[]}
                onDismissAll={async () => undefined}
                onDismissNotification={async () => undefined}
                onOpenAlertProduct={() => undefined}
                onOpenTaskDetail={() => undefined}
                onOpenTasks={() => undefined}
                tasks={[]}
              />
            ) : route === 'account' ? (
              <AccountScreen
                avatarUrl={null}
                businessName={ownerProfile.businessName}
                fullName={ownerProfile.businessName}
                onOpenEditProfile={() => undefined}
                onOpenStaffInvite={() => undefined}
                onOpenWhatsAppSetup={() => setRoute('account')}
                onSignOut={props.onSignOut}
                onUploadAvatar={async () => undefined}
                role="owner"
                timezoneLabel="Argentina / Cordoba"
                whatsappConnection={legacyWhatsAppConnection}
              />
            ) : (
              <MoreScreen
                onOpenRow={(rowId) => {
                  if (rowId === 'account') {
                    setRoute('account');
                    return;
                  }

                  if (rowId === 'manage-stock' || rowId === 'add-product') {
                    openManageStock();
                  }
                }}
              />
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
